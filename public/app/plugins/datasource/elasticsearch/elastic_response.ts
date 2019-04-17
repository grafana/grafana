import _ from 'lodash';
import * as queryDef from './query_def';
import TableModel from 'app/core/table_model';

export class ElasticResponse {
  constructor(private targets, private response) {
    this.targets = targets;
    this.response = response;
  }

  processMetrics(esAgg, target, seriesList, props) {
    let metric, y, i, newSeries, bucket, value;

    for (y = 0; y < target.metrics.length; y++) {
      metric = target.metrics[y];
      if (metric.hide) {
        continue;
      }

      switch (metric.type) {
        case 'count': {
          newSeries = { datapoints: [], metric: 'count', props: props };
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

          const firstBucket = esAgg.buckets[0];
          const percentiles = firstBucket[metric.id].values;

          for (const percentileName in percentiles) {
            newSeries = {
              datapoints: [],
              metric: 'p' + percentileName,
              props: props,
              field: metric.field,
            };

            for (i = 0; i < esAgg.buckets.length; i++) {
              bucket = esAgg.buckets[i];
              const values = bucket[metric.id].values;
              newSeries.datapoints.push([values[percentileName], bucket.key]);
            }
            seriesList.push(newSeries);
          }

          break;
        }
        case 'extended_stats': {
          for (const statName in metric.meta) {
            if (!metric.meta[statName]) {
              continue;
            }

            newSeries = {
              datapoints: [],
              metric: statName,
              props: props,
              field: metric.field,
            };

            for (i = 0; i < esAgg.buckets.length; i++) {
              bucket = esAgg.buckets[i];
              const stats = bucket[metric.id];

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
          newSeries = {
            datapoints: [],
            metric: metric.type,
            field: metric.field,
            metricId: metric.id,
            props: props,
          };
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
  }

  processAggregationDocs(esAgg, aggDef, target, table, props) {
    // add columns
    if (table.columns.length === 0) {
      for (const propKey of _.keys(props)) {
        table.addColumn({ text: propKey, filterable: true });
      }
      table.addColumn({ text: aggDef.field, filterable: true });
    }

    // helper func to add values to value array
    const addMetricValue = (values, metricName, value) => {
      table.addColumn({ text: metricName });
      values.push(value);
    };

    for (const bucket of esAgg.buckets) {
      const values = [];

      for (const propValues of _.values(props)) {
        values.push(propValues);
      }

      // add bucket key (value)
      values.push(bucket.key);

      for (const metric of target.metrics) {
        switch (metric.type) {
          case 'count': {
            addMetricValue(values, this.getMetricName(metric.type), bucket.doc_count);
            break;
          }
          case 'extended_stats': {
            for (const statName in metric.meta) {
              if (!metric.meta[statName]) {
                continue;
              }

              const stats = bucket[metric.id];
              // add stats that are in nested obj to top level obj
              stats.std_deviation_bounds_upper = stats.std_deviation_bounds.upper;
              stats.std_deviation_bounds_lower = stats.std_deviation_bounds.lower;

              addMetricValue(values, this.getMetricName(statName), stats[statName]);
            }
            break;
          }
          case 'percentiles': {
            const percentiles = bucket[metric.id].values;

            for (const percentileName in percentiles) {
              addMetricValue(values, `p${percentileName} ${metric.field}`, percentiles[percentileName]);
            }
            break;
          }
          default: {
            let metricName = this.getMetricName(metric.type);
            const otherMetrics = _.filter(target.metrics, { type: metric.type });

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
  }

  // This is quite complex
  // need to recurise down the nested buckets to build series
  processBuckets(aggs, target, seriesList, table, props, depth) {
    let bucket, aggDef, esAgg, aggId;
    const maxDepth = target.bucketAggs.length - 1;

    for (aggId in aggs) {
      aggDef = _.find(target.bucketAggs, { id: aggId });
      esAgg = aggs[aggId];

      if (!aggDef) {
        continue;
      }

      if (depth === maxDepth) {
        if (aggDef.type === 'date_histogram') {
          this.processMetrics(esAgg, target, seriesList, props);
        } else {
          this.processAggregationDocs(esAgg, aggDef, target, table, props);
        }
      } else {
        for (const nameIndex in esAgg.buckets) {
          bucket = esAgg.buckets[nameIndex];
          props = _.clone(props);
          if (bucket.key !== void 0) {
            props[aggDef.field] = bucket.key;
          } else {
            props['filter'] = nameIndex;
          }
          if (bucket.key_as_string) {
            props[aggDef.field] = bucket.key_as_string;
          }
          this.processBuckets(bucket, target, seriesList, table, props, depth + 1);
        }
      }
    }
  }

  private getMetricName(metric) {
    let metricDef: any = _.find(queryDef.metricAggTypes, { value: metric });
    if (!metricDef) {
      metricDef = _.find(queryDef.extendedStats, { value: metric });
    }

    return metricDef ? metricDef.text : metric;
  }

  private getSeriesName(series, target, metricTypeCount) {
    let metricName = this.getMetricName(series.metric);

    if (target.alias) {
      const regex = /\{\{([\s\S]+?)\}\}/g;

      return target.alias.replace(regex, (match, g1, g2) => {
        const group = g1 || g2;

        if (group.indexOf('term ') === 0) {
          return series.props[group.substring(5)];
        }
        if (series.props[group] !== void 0) {
          return series.props[group];
        }
        if (group === 'metric') {
          return metricName;
        }
        if (group === 'field') {
          return series.field || '';
        }

        return match;
      });
    }

    if (series.field && queryDef.isPipelineAgg(series.metric)) {
      if (series.metric && queryDef.isPipelineAggWithMultipleBucketPaths(series.metric)) {
        const agg: any = _.find(target.metrics, { id: series.metricId });
        if (agg && agg.settings.script) {
          metricName = agg.settings.script;

          for (const pv of agg.pipelineVariables) {
            const appliedAgg: any = _.find(target.metrics, { id: pv.pipelineAgg });
            if (appliedAgg) {
              metricName = metricName.replace('params.' + pv.name, queryDef.describeMetric(appliedAgg));
            }
          }
        } else {
          metricName = 'Unset';
        }
      } else {
        const appliedAgg: any = _.find(target.metrics, { id: series.field });
        if (appliedAgg) {
          metricName += ' ' + queryDef.describeMetric(appliedAgg);
        } else {
          metricName = 'Unset';
        }
      }
    } else if (series.field) {
      metricName += ' ' + series.field;
    }

    const propKeys = _.keys(series.props);
    if (propKeys.length === 0) {
      return metricName;
    }

    let name = '';
    for (const propName in series.props) {
      name += series.props[propName] + ' ';
    }

    if (metricTypeCount === 1) {
      return name.trim();
    }

    return name.trim() + ' ' + metricName;
  }

  nameSeries(seriesList, target) {
    const metricTypeCount = _.uniq(_.map(seriesList, 'metric')).length;

    for (let i = 0; i < seriesList.length; i++) {
      const series = seriesList[i];
      series.target = this.getSeriesName(series, target, metricTypeCount);
    }
  }

  processHits(hits, seriesList) {
    const series = {
      target: 'docs',
      type: 'docs',
      datapoints: [],
      total: hits.total,
      filterable: true,
    };
    let propName, hit, doc, i;

    for (i = 0; i < hits.hits.length; i++) {
      hit = hits.hits[i];
      doc = {
        _id: hit._id,
        _type: hit._type,
        _index: hit._index,
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
  }

  trimDatapoints(aggregations, target) {
    const histogram: any = _.find(target.bucketAggs, { type: 'date_histogram' });

    const shouldDropFirstAndLast = histogram && histogram.settings && histogram.settings.trimEdges;
    if (shouldDropFirstAndLast) {
      const trim = histogram.settings.trimEdges;
      for (const prop in aggregations) {
        const points = aggregations[prop];
        if (points.datapoints.length > trim * 2) {
          points.datapoints = points.datapoints.slice(trim, points.datapoints.length - trim);
        }
      }
    }
  }

  getErrorFromElasticResponse(response, err) {
    const result: any = {};
    result.data = JSON.stringify(err, null, 4);
    if (err.root_cause && err.root_cause.length > 0 && err.root_cause[0].reason) {
      result.message = err.root_cause[0].reason;
    } else {
      result.message = err.reason || 'Unkown elastic error response';
    }

    if (response.$$config) {
      result.config = response.$$config;
    }

    return result;
  }

  getTimeSeries() {
    const seriesList = [];

    for (let i = 0; i < this.response.responses.length; i++) {
      const response = this.response.responses[i];
      if (response.error) {
        throw this.getErrorFromElasticResponse(this.response, response.error);
      }

      if (response.hits && response.hits.hits.length > 0) {
        this.processHits(response.hits, seriesList);
      }

      if (response.aggregations) {
        const aggregations = response.aggregations;
        const target = this.targets[i];
        const tmpSeriesList = [];
        const table = new TableModel();

        this.processBuckets(aggregations, target, tmpSeriesList, table, {}, 0);
        this.trimDatapoints(tmpSeriesList, target);
        this.nameSeries(tmpSeriesList, target);

        for (let y = 0; y < tmpSeriesList.length; y++) {
          seriesList.push(tmpSeriesList[y]);
        }

        if (table.rows.length > 0) {
          seriesList.push(table);
        }
      }
    }

    return { data: seriesList };
  }
}
