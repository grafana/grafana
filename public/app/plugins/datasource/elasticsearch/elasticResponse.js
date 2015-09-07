define([
],
function () {
  'use strict';

  function ElasticResponse(targets, response) {
    this.targets = targets;
    this.response = response;
  }

  // This is quite complex
  // neeed to recurise down the nested buckets to build series
  ElasticResponse.prototype.processBuckets = function(aggs, target, series, level, parentName) {
    var seriesName, value, metric, i, y, bucket, aggDef, esAgg;

    function addMetricPoint(seriesName, value, time) {
      var current = series[seriesName];
      if (!current) {
        current = series[seriesName] = {target: seriesName, datapoints: []};
      }
      current.datapoints.push([value, time]);
    }

    aggDef = target.bucketAggs[level];
    esAgg = aggs[aggDef.id];

    for (i = 0; i < esAgg.buckets.length; i++) {
      bucket = esAgg.buckets[i];

      // if last agg collect series
      if (level === target.bucketAggs.length - 1) {
        for (y = 0; y < target.metrics.length; y++) {
          metric = target.metrics[y];
          seriesName = parentName;

          switch(metric.type) {
            case 'count': {
              seriesName += ' count';
              value = bucket.doc_count;
              addMetricPoint(seriesName, value, bucket.key);
              break;
            }
            case 'percentiles': {
              var values = bucket[metric.id].values;
              for (var prop in values) {
                addMetricPoint(seriesName + ' ' + prop, values[prop], bucket.key);
              }
              break;
            }
            case 'extended_stats': {
              var stats = bucket[metric.id];
              stats.std_deviation_bounds_upper = stats.std_deviation_bounds.upper;
              stats.std_deviation_bounds_lower = stats.std_deviation_bounds.lower;

              for (var statName in metric.meta) {
                if (metric.meta[statName]) {
                  addMetricPoint(seriesName + ' ' + statName, stats[statName], bucket.key);
                }
              }
              break;
            }
            default: {
              seriesName += ' ' + metric.field + ' ' + metric.type;
              value = bucket[metric.id].value;
              addMetricPoint(seriesName, value, bucket.key);
              break;
            }
          }
        }
      }
      else {
        this.processBuckets(bucket, target, series, level+1, parentName + ' ' + bucket.key);
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
      var querySeries = {};

      this.processBuckets(aggregations, target, querySeries, 0, target.refId);

      for (var prop in querySeries) {
        if (querySeries.hasOwnProperty(prop)) {
          series.push(querySeries[prop]);
        }
      }
    }

    return { data: series };
  };

  return ElasticResponse;
});
