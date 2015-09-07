define([
  "lodash"
],
function (_) {
  'use strict';

  function ElasticResponse(targets, response) {
    this.targets = targets;
    this.response = response;
  }

  // This is quite complex
  // neeed to recurise down the nested buckets to build series
  ElasticResponse.prototype.processBuckets = function(aggs, target, series, level) {
    var value, metric, i, y, bucket, aggDef, esAgg, nestedSeries;

    aggDef = target.bucketAggs[level];
    esAgg = aggs[aggDef.id];

    if (level < target.bucketAggs.length - 1) {
      for (i = 0; i < esAgg.buckets.length; i++) {
        bucket = esAgg.buckets[i];
        nestedSeries = {prop: {key: bucket.key, field: aggDef.field}, series: []};
        series.push(nestedSeries);
        this.processBuckets(bucket, target, nestedSeries.series, level+1);
      }
      return;
    }

    for (y = 0; y < target.metrics.length; y++) {
      metric = target.metrics[y];

      switch(metric.type) {
        case 'count': {
          var countSeries = { datapoints: [], metric: 'count'};
          for (i = 0; i < esAgg.buckets.length; i++) {
            bucket = esAgg.buckets[i];
            value = bucket.doc_count;
            countSeries.datapoints.push([value, bucket.key]);
          }
          series.push(countSeries);
          break;
        }
        case 'percentiles': {
          // for (i = 0; i < esAgg.buckets.length; i++) {
          //   bucket = esAgg.buckets[i];
          //   var values = bucket[metric.id].values;
          //   for (var prop in values) {
          //     addMetricPoint(seriesName + ' ' + prop, values[prop], bucket.key);
          //   }
          // }
          break;
        }
        case 'extended_stats': {
          // var stats = bucket[metric.id];
          // stats.std_deviation_bounds_upper = stats.std_deviation_bounds.upper;
          // stats.std_deviation_bounds_lower = stats.std_deviation_bounds.lower;
          //
          // for (var statName in metric.meta) {
          //   if (metric.meta[statName]) {
          //     addMetricPoint(seriesName + ' ' + statName, stats[statName], bucket.key);
          //   }
          // }
          break;
        }
        default: {
          var newSeries = { datapoints: [], metric: metric.type + ' ' + metric.field };
          for (i = 0; i < esAgg.buckets.length; i++) {
            bucket = esAgg.buckets[i];
            value = bucket[metric.id].value;
            newSeries.datapoints.push([value, bucket.key]);
          }
          series.push(newSeries);
          break;
        }
      }
    }
  };

  ElasticResponse.prototype._getSeriesName = function(props, metric, alias) {
    if (alias) {
      return alias;
    }

    var propKeys = _.keys(props);
    if (propKeys.length === 0) {
      return metric;
    }

    var name = '';
    for (var propName in props) {
      name += props[propName] + ' ';
    }

    if (propKeys.length === 1) {
      return name.trim();
    }

    return name.trim() + ' ' + metric;
  };

  ElasticResponse.prototype._collectSeriesFromTree = function(seriesTree, props, seriesList, alias) {
    console.log('props: ', props);

    for (var i = 0; i < seriesTree.length; i++) {
      var series = seriesTree[i];
      if (series.datapoints) {
        series.target = this._getSeriesName(props, series.metric, alias);
        seriesList.push(series);
      } else {
        props = _.clone(props);
        props[series.prop.field] = series.prop.key;
        this._collectSeriesFromTree(series.series, props, seriesList);
      }
    }
  };

  ElasticResponse.prototype.getTimeSeries = function() {
    var series = [];

    for (var i = 0; i < this.response.responses.length; i++) {
      var response = this.response.responses[i];
      if (response.error) {
        throw { message: response.error };
      }

      var aggregations = response.aggregations;
      var target = this.targets[i];
      var seriesTree = [];

      this.processBuckets(aggregations, target, seriesTree, 0, '');
      this._collectSeriesFromTree(seriesTree, {}, series, '');
    }

    return { data: series };
  };

  return ElasticResponse;
});
