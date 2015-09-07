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
  ElasticResponse.prototype.processBuckets = function(aggs, target, seriesList, level, props) {
    var value, metric, i, y, bucket, aggDef, esAgg, newSeries;

    aggDef = target.bucketAggs[level];
    esAgg = aggs[aggDef.id];

    if (level < target.bucketAggs.length - 1) {
      for (i = 0; i < esAgg.buckets.length; i++) {
        bucket = esAgg.buckets[i];
        props = _.clone(props);
        props[aggDef.field] = bucket.key;
        this.processBuckets(bucket, target, seriesList, level+1, props);
      }
      return;
    }

    for (y = 0; y < target.metrics.length; y++) {
      metric = target.metrics[y];

      switch(metric.type) {
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
            newSeries = {datapoints: [], metric: 'p' + percentileName, props: props};

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

            newSeries = {datapoints: [], metric: statName, props: props};

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
          newSeries = { datapoints: [], metric: metric.type + ' ' + metric.field, props: props};
          for (i = 0; i < esAgg.buckets.length; i++) {
            bucket = esAgg.buckets[i];
            value = bucket[metric.id].value;
            newSeries.datapoints.push([value, bucket.key]);
          }
          seriesList.push(newSeries);
          break;
        }
      }
    }
  };

  ElasticResponse.prototype._getSeriesName = function(props, metric, target, metricTypeCount) {
    if (target.alias) {
      var regex = /\{\{([\s\S]+?)\}\}/g;

      return target.alias.replace(regex, function(match, g1, g2) {
        var group = g1 || g2;

        if (props[group]) { return props[group]; }
        if (group === 'metric') { return metric; }

        return match;
      });
    }

    var propKeys = _.keys(props);
    if (propKeys.length === 0) {
      return metric;
    }

    var name = '';
    for (var propName in props) {
      name += props[propName] + ' ';
    }

    if (metricTypeCount === 1) {
      return name.trim();
    }

    return name.trim() + ' ' + metric;
  };

  ElasticResponse.prototype.getTimeSeries = function() {
    var seriesList = [];

    for (var i = 0; i < this.response.responses.length; i++) {
      var response = this.response.responses[i];
      if (response.error) {
        throw { message: response.error };
      }

      var aggregations = response.aggregations;
      var target = this.targets[i];
      var tmpSeriesList = [];

      this.processBuckets(aggregations, target, tmpSeriesList, 0, {});

      var metricTypeCount = _.uniq(_.pluck(tmpSeriesList, 'metric')).length;

      for (var y = 0; y < tmpSeriesList.length; y++) {
        var series= tmpSeriesList[y];
        series.target = this._getSeriesName(series.props, series.metric, target, metricTypeCount);
        seriesList.push(series);
      }
    }

    return { data: seriesList };
  };

  return ElasticResponse;
});
