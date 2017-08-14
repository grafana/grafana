///<reference path="../../../headers/common.d.ts" />

import  _ from 'lodash';
import queryDef from "./query_def";
import TableModel from 'app/core/table_model';

export function ElasticResponse(targets, response) {
  this.targets = targets;
  this.response = response;
}

ElasticResponse.prototype.processMetrics = function(esAgg, target, seriesList, props) {
  var metric, y, i, newSeries, bucket, value;

  for (y = 0; y < target.metrics.length; y++) {
    metric = target.metrics[y];
    if (metric.hide) {
      continue;
    }

    switch (metric.type) {
      case 'count': {
        newSeries = { datapoints: [], metric: 'count', props: props};
        for (i = 0; i < esAgg.buckets.length; i++) {
          bucket = esAgg.buckets[i];
          value = bucket.doc_count;
          newSeries.datapoints.push([value, bucket.key]);
        }
        seriesList.push(newSeries);
        break;
      }
      case 'percentiles': {
        if (esAgg.buckets.length === 0) {
          break;
        }

        var firstBucket = esAgg.buckets[0];
        var percentiles = firstBucket[metric.id].values;

        for (var percentileName in percentiles) {
          newSeries = {datapoints: [], metric: 'p' + percentileName, props: props, field: metric.field};

          for (i = 0; i < esAgg.buckets.length; i++) {
            bucket = esAgg.buckets[i];
            var values = bucket[metric.id].values;
            newSeries.datapoints.push([values[percentileName], bucket.key]);
          }
          seriesList.push(newSeries);
        }

        break;
      }
      case 'extended_stats': {
        for (var statName in metric.meta) {
          if (!metric.meta[statName]) {
            continue;
          }

          newSeries = {datapoints: [], metric: statName, props: props, field: metric.field};

          for (i = 0; i < esAgg.buckets.length; i++) {
            bucket = esAgg.buckets[i];
            var stats = bucket[metric.id];

            // add stats that are in nested obj to top level obj
            stats.std_deviation_bounds_upper = stats.std_deviation_bounds.upper;
            stats.std_deviation_bounds_lower = stats.std_deviation_bounds.lower;

            newSeries.datapoints.push([stats[statName], bucket.key]);
          }

          seriesList.push(newSeries);
        }

        break;
      }
      default: {
        newSeries = { datapoints: [], metric: metric.type, field: metric.field, props: props};
        for (i = 0; i < esAgg.buckets.length; i++) {
          bucket = esAgg.buckets[i];

          value = bucket[metric.id];
          if (value !== undefined) {
            if (value.normalized_value) {
              newSeries.datapoints.push([value.normalized_value, bucket.key]);
            } else {
              newSeries.datapoints.push([value.value, bucket.key]);
            }
          }

        }
        seriesList.push(newSeries);
        break;
      }
    }
  }
};

ElasticResponse.prototype.processAggregationDocs = function(esAgg, aggDef, target, table, props) {
  // add columns
  if (table.columns.length === 0) {
    for (let propKey of _.keys(props)) {
      table.addColumn({text: propKey, filterable: true});
    }
    table.addColumn({text: aggDef.field, filterable: true});
  }

  // helper func to add values to value array
  let addMetricValue = (values, metricName, value) => {
    table.addColumn({text: metricName});
    values.push(value);
  };

  for (let bucket of esAgg.buckets) {
    let values = [];

    for (let propValues of _.values(props)) {
      values.push(propValues);
    }

    // add bucket key (value)
    values.push(bucket.key);

    for (let metric of target.metrics) {
      switch (metric.type) {
        case "count": {
          addMetricValue(values, this._getMetricName(metric.type), bucket.doc_count);
          break;
        }
        case 'extended_stats': {
          for (var statName in metric.meta) {
            if (!metric.meta[statName]) {
              continue;
            }

            var stats = bucket[metric.id];
            // add stats that are in nested obj to top level obj
            stats.std_deviation_bounds_upper = stats.std_deviation_bounds.upper;
            stats.std_deviation_bounds_lower = stats.std_deviation_bounds.lower;

            addMetricValue(values, this._getMetricName(statName), stats[statName]);
          }
          break;
        }
        default:  {
          let metricName = this._getMetricName(metric.type);
          let otherMetrics = _.filter(target.metrics, {type: metric.type});

          // if more of the same metric type include field field name in property
          if (otherMetrics.length > 1) {
            metricName += ' ' + metric.field;
          }

          addMetricValue(values, metricName, bucket[metric.id].value);
          break;
        }
      }
    }

    table.rows.push(values);
  }
};

// This is quite complex
// neeed to recurise down the nested buckets to build series
ElasticResponse.prototype.processBuckets = function(aggs, target, seriesList, table, props, depth) {
  var bucket, aggDef, esAgg, aggId;
  var maxDepth = target.bucketAggs.length-1;

  for (aggId in aggs) {
    aggDef = _.find(target.bucketAggs, {id: aggId});
    esAgg = aggs[aggId];

    if (!aggDef) {
      continue;
    }

    if (depth === maxDepth) {
      if (aggDef.type === 'date_histogram')  {
        this.processMetrics(esAgg, target, seriesList, props);
      } else {
        this.processAggregationDocs(esAgg, aggDef, target, table, props);
      }
    } else {
      for (var nameIndex in esAgg.buckets) {
        bucket = esAgg.buckets[nameIndex];
        props = _.clone(props);
        if (bucket.key !== void 0) {
          props[aggDef.field] = bucket.key;
        } else {
          props["filter"] = nameIndex;
        }
        if (bucket.key_as_string) {
          props[aggDef.field] = bucket.key_as_string;
        }
        this.processBuckets(bucket, target, seriesList, table, props, depth+1);
      }
    }
  }
};

ElasticResponse.prototype._getMetricName = function(metric) {
  var metricDef = _.find(queryDef.metricAggTypes, {value: metric});
  if (!metricDef)  {
    metricDef = _.find(queryDef.extendedStats, {value: metric});
  }

  return metricDef ? metricDef.text : metric;
};

ElasticResponse.prototype._getSeriesName = function(series, target, metricTypeCount) {
  var metricName = this._getMetricName(series.metric);

  if (target.alias) {
    var regex = /\{\{([\s\S]+?)\}\}/g;

    return target.alias.replace(regex, function(match, g1, g2) {
      var group = g1 || g2;

      if (group.indexOf('term ') === 0) { return series.props[group.substring(5)]; }
      if (series.props[group] !== void 0) { return series.props[group]; }
      if (group === 'metric') { return metricName; }
      if (group === 'field') { return series.field; }

      return match;
    });
  }

  if (series.field && queryDef.isPipelineAgg(series.metric)) {
    var appliedAgg = _.find(target.metrics, { id: series.field });
    if (appliedAgg) {
      metricName += ' ' + queryDef.describeMetric(appliedAgg);
    } else {
      metricName = 'Unset';
    }
  } else if (series.field) {
    metricName += ' ' + series.field;
  }

  var propKeys = _.keys(series.props);
  if (propKeys.length === 0) {
    return metricName;
  }

  var name = '';
  for (var propName in series.props) {
    name += series.props[propName] + ' ';
  }

  if (metricTypeCount === 1) {
    return name.trim();
  }

  return name.trim() + ' ' + metricName;
};

ElasticResponse.prototype.nameSeries = function(seriesList, target) {
  var metricTypeCount = _.uniq(_.map(seriesList, 'metric')).length;
  var fieldNameCount = _.uniq(_.map(seriesList, 'field')).length;

  for (var i = 0; i < seriesList.length; i++) {
    var series = seriesList[i];
    series.target = this._getSeriesName(series, target, metricTypeCount, fieldNameCount);
  }
};

ElasticResponse.prototype.processHits = function(hits, seriesList) {
  var series = {target: 'docs', type: 'docs', datapoints: [], total: hits.total, filterable: true};
  var propName, hit, doc, i;

  for (i = 0; i < hits.hits.length; i++) {
    hit = hits.hits[i];
    doc = {
      _id: hit._id,
      _type: hit._type,
      _index: hit._index
    };

    if (hit._source) {
      for (propName in hit._source) {
        doc[propName] = hit._source[propName];
      }
    }

    for (propName in hit.fields) {
      doc[propName] = hit.fields[propName];
    }
    series.datapoints.push(doc);
  }

  seriesList.push(series);
};

ElasticResponse.prototype.trimDatapoints = function(aggregations, target) {
  var histogram = _.find(target.bucketAggs, { type: 'date_histogram'});

  var shouldDropFirstAndLast = histogram && histogram.settings && histogram.settings.trimEdges;
  if (shouldDropFirstAndLast) {
    var trim = histogram.settings.trimEdges;
    for (var prop in aggregations) {
      var points = aggregations[prop];
      if (points.datapoints.length > trim * 2) {
        points.datapoints = points.datapoints.slice(trim, points.datapoints.length - trim);
      }
    }
  }
};

ElasticResponse.prototype.getErrorFromElasticResponse = function(response, err) {
  var result: any = {};
  result.data = JSON.stringify(err, null, 4);
  if (err.root_cause && err.root_cause.length > 0 && err.root_cause[0].reason) {
    result.message = err.root_cause[0].reason;
  } else {
    result.message = err.reason || 'Unkown elatic error response';
  }

  if (response.$$config) {
    result.config = response.$$config;
  }

  return result;
};

ElasticResponse.prototype.getTimeSeries = function() {
  var seriesList = [];

  for (var i = 0; i < this.response.responses.length; i++) {
    var response = this.response.responses[i];
    if (response.error) {
      throw this.getErrorFromElasticResponse(this.response, response.error);
    }

    if (response.hits && response.hits.hits.length > 0) {
      this.processHits(response.hits, seriesList);
    }

    if (response.aggregations) {
      var aggregations = response.aggregations;
      var target = this.targets[i];
      var tmpSeriesList = [];
      var table = new TableModel();

      this.processBuckets(aggregations, target, tmpSeriesList, table, {}, 0);
      this.trimDatapoints(tmpSeriesList, target);
      this.nameSeries(tmpSeriesList, target);

      for (var y = 0; y < tmpSeriesList.length; y++) {
        seriesList.push(tmpSeriesList[y]);
      }

      if (table.rows.length > 0) {
        seriesList.push(table);
      }
    }
  }

  return { data: seriesList };
};

