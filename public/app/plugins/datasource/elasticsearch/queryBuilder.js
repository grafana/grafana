define([
],
function () {
  'use strict';

  function ElasticQueryBuilder() {
  }

  ElasticQueryBuilder.prototype.build = function(targets) {
    var query = {
      "aggs": {},
      "size": "$maxDataPoints"
    };
    var self = this;
    targets.forEach(function(target) {
      if (!target.hide) {
        query["aggs"][target.termKey + "_" + target.termValue] = {
          "filter": {
            "and": [
              self._buildRangeFilter(target),
              self._buildTermFilter(target)
            ]
          },
          "aggs": {
            "date_histogram": {
              "date_histogram": {
                "interval": target.interval || "$interval",
                "field": target.keyField,
                "min_doc_count": 0,
              },
              "aggs": {
                "metric": {
                  "stats": {
                    "field": target.valueField
                  }
                }
              }
            }
          }
        };
      }
    });
    query = JSON.stringify(query);
    return query;
  };

  ElasticQueryBuilder.prototype._buildRangeFilter = function(target) {
    var filter = {"range":{}};
    filter["range"][target.keyField] = {
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
