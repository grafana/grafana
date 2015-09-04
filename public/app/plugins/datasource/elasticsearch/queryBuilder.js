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

    query.aggs = {
      "histogram": {
        "date_histogram": {
          "interval": target.interval || "$interval",
          "field": target.timeField,
          "min_doc_count": 0,
          "extended_bounds": {
            "min": "$timeFrom",
            "max": "$timeTo"
          }
        }
      },
    };

    var nestedAggs = query.aggs.histogram;
    var i;

    target.groupByFields = target.groupByFields || [];

    for (i = 0; i < target.groupByFields.length; i++) {
      var field = target.groupByFields[i].field;
      var aggs = {terms: {field: field}};

      nestedAggs.aggs = {};
      nestedAggs.aggs[field] = aggs;
      nestedAggs = aggs;
    }

    nestedAggs.aggs = {};

    for (i = 0; i < target.select.length; i++) {
      var select = target.select[i];
      if (select.field) {
        var aggField = {};
        aggField[select.agg] = {field: select.field};

        nestedAggs.aggs[i.toString()] = aggField;
      }
    }

    return query;
  };

  return ElasticQueryBuilder;

});
