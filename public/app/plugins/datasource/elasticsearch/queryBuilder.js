define([
],
function () {
  'use strict';

  function ElasticQueryBuilder() { }

  ElasticQueryBuilder.prototype.build = function(target, timeFrom, timeTo) {
    if (target.rawQuery) {
      return angular.fromJson(target.rawJson);
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
              "must": [
                {
                  "range": {
                    "@timestamp": {
                      "gte": timeFrom,
                      "lte": timeTo
                    }
                  }
                }
              ],
              "must_not": [

              ]
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
            "min": timeFrom,
            "max": timeTo
          }
        }
      },
    };

    var nestedAggs = query.aggs.histogram;
    target.groupByFields = target.groupByFields || [];

    for (var i = 0; i < target.groupByFields.length; i++) {
      var field = target.groupByFields[i].field;
      var aggs = {terms: {field: field}};

      nestedAggs.aggs = {};
      nestedAggs.aggs[field] = aggs;
      nestedAggs = aggs;
    }

    nestedAggs.aggs = {};

    for (var i = 0; i < target.select.length; i++) {
      var select = target.select[i];
      if (select.field) {
        var aggField = {};
        aggField[select.agg] = {field: select.field};

        nestedAggs.aggs[i.toString()] = aggField;
      }
    }

    console.log(angular.toJson(query, true));
    return query;
  };

  return ElasticQueryBuilder;

});
