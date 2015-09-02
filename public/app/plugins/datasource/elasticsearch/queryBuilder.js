define([
],
function () {
  'use strict';

  function ElasticQueryBuilder() { }

  ElasticQueryBuilder.prototype.build = function(targets) {
    var query = {
      "aggs": {},
      "size": "$maxDataPoints"
    };

    var self = this;
    targets.forEach(function(target, index) {
      if (target.hide) {
        return;
      }

      var esQuery = {
        "filter": {
          "and": [
            self._buildRangeFilter(target)
          ]
        },
        "aggs": {
          "date_histogram": {
            "date_histogram": {
              "interval": target.interval || "$interval",
              "field": target.timestampField,
              "min_doc_count": 0,
            },
            "aggs": {
              "stats": {
                "stats": {
                  "field": target.valueField
                }
              }
            }
          }
        }
      };
      if (target.groupByField) {
        query["aggs"][target.termKey + "_" + target.termValue]["aggs"] = {
          "terms": {
            "terms": {
              "field": target.groupByField
            },
            "aggs": query["aggs"][target.termKey + "_" + target.termValue]["aggs"]
          }
        };
      }

      query["aggs"]['query:' + index] = esQuery;
    });
    query = JSON.stringify(query);
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
