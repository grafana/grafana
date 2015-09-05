define([
  "angular"
],
function (angular) {
  'use strict';

  function ElasticQueryBuilder() { }

  ElasticQueryBuilder.prototype.getRangeFilter = function(timeField) {
    var filter = {};
    filter[timeField] = {"gte": "$timeFrom", "lte": "$timeTo"};
    return filter;
  };

  ElasticQueryBuilder.prototype.build = function(target) {
    if (target.rawQuery) {
      return angular.fromJson(target.rawQuery);
    }

    var i, y, nestedAggs, metric, metricRef;
    var query = {
      "size": 0,
      "query": {
        "filtered": {
          "query": {
            "query_string": {
              "analyze_wildcard": true,
              "query": target.query || '*' ,
            }
          },
          "filter": {
            "bool": {
              "must": [{"range": this.getRangeFilter(target.timeField)}]
            }
          }
        }
      }
    };

    nestedAggs = query;

    for (i = 0; i < target.bucketAggs.length; i++) {
      var aggDef = target.bucketAggs[i];
      var esAgg = {};

      switch(aggDef.type) {
        case 'date_histogram': {
          esAgg["date_histogram"] = {
            "interval": target.interval || "$interval",
            "field": aggDef.field,
            "min_doc_count": 1,
            "extended_bounds": { "min": "$timeFrom", "max": "$timeTo" }
          };
          break;
        }
        case 'terms': {
          esAgg.terms = { "field": aggDef.field };
          var size = parseInt(aggDef.size, 10);
          if (size > 0) { esAgg.terms.size = size; }
          if (aggDef.orderBy != void 0) {
            esAgg.terms.order = {};
            esAgg.terms.order[aggDef.orderBy] = aggDef.order;

            // if metric ref, look it up and add it to this agg level
            metricRef = parseInt(aggDef.orderBy, 10);
            if (!isNaN(metricRef)) {
              for (y = 0; y < target.metrics.length; y++) {
                metric = target.metrics[y];
                if (metric.id === aggDef.orderBy) {
                  esAgg.aggs = {};
                  esAgg.aggs[metric.id] = {}
                  esAgg.aggs[metric.id][metric.type] = {field: metric.field};
                  break;
                }
              }
            }
          }
          break;
        }
      }

      nestedAggs.aggs = nestedAggs.aggs || {};
      nestedAggs.aggs[aggDef.id] = esAgg;
      nestedAggs = esAgg;
    }

    nestedAggs.aggs = {};

    for (i = 0; i < target.metrics.length; i++) {
      metric = target.metrics[i];
      if (metric.type === 'count') {
        continue;
      }

      var metricAgg = {field: metric.field};
      for (var prop in metric.settings) {
        if (metric.settings.hasOwnProperty(prop)) {
          metricAgg[prop] = metric.settings[prop];
        }
      }

      var aggField = {};
      aggField[metric.type] = metricAgg;
      nestedAggs.aggs[metric.id] = aggField;
    }

    return query;
  };

  return ElasticQueryBuilder;

});
