define([
],
function () {
  'use strict';

  function ElasticQueryBuilder(target) {
    this.target = target;
  }

  ElasticQueryBuilder.prototype.build = function() {
    var target = this.target;
    var query = {
      "facets": {
        "metric": {
          "date_histogram": {
            "interval": "$interval",
            "key_field": "@timestamp",
            "min_doc_count": 0,
            "value_field": "metric"
          }
        }
      },
      "fields": [],
      "query": {
        "filtered": {
          "filter": {
            "and": [
              {
                "range": {
                  "@timestamp": {
                    "gte": "$rangeFrom",
                    "lte": "$rangeTo"
                  }
                }
              },
              {
                "term": {
                  "service": "cpu",
                }
              }
            ]
          }
        }
      },
      "size": "$maxDataPoints",
      "sort": "@timestamp"
    };
    query = JSON.stringify(query);
    target.query = query;
    return query;
  };

  return ElasticQueryBuilder;
});
