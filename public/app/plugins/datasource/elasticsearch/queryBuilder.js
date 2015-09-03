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

    for (var i = 0; i < target.groupByFields.length; i++) {
      var field = target.groupByFields[i].field;
      var aggs = {terms: {field: field}};

      nestedAggs.aggs = {};
      nestedAggs.aggs[field] = aggs;
      nestedAggs = aggs;
    }

    console.log(angular.toJson(query, true));

    query = angular.toJson(query);
    return query;
  };

  ElasticQueryBuilder.prototype._buildRangeFilter = function(target) {
    var filter = {"range":{}};
    filter["range"][target.timestampField] = {
      "gte": "$rangeFrom",
      "lte": "$rangeTo"
    };
    return filter;
  };

  ElasticQueryBuilder.prototype._buildTermFilter = function(target) {
    var filter = {"term":{}};
    filter["term"][target.termKey] = target.termValue;
    return filter;
  };

  return ElasticQueryBuilder;
});
