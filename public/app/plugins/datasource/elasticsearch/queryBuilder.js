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

    var i, nestedAggs;
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
            "min_doc_count": 0,
            "extended_bounds": { "min": "$timeFrom", "max": "$timeTo" }
          };
          break;
        }
        case 'terms': {
          esAgg["terms"] = { "field": aggDef.field };
          break;
        }
      }

      nestedAggs.aggs = {};
      nestedAggs.aggs['b' + i] = esAgg;
      nestedAggs = esAgg;
    }

    nestedAggs.aggs = {};

    for (i = 0; i < target.metrics.length; i++) {
      var metric = target.metrics[i];
      if (metric.field) {
        var aggField = {};
        aggField[metric.type] = {field: metric.field};

        nestedAggs.aggs['m' + i] = aggField;
      }
    }

    return query;
  };

  return ElasticQueryBuilder;

});
