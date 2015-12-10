define([
  './query_def'
],
function (queryDef) {
  'use strict';

  function ElasticQueryBuilder(options) {
    this.timeField = options.timeField;
    this.esVersion = options.esVersion;
  }

  ElasticQueryBuilder.prototype.getRangeFilter = function() {
    var filter = {};
    filter[this.timeField] = {"gte": "$timeFrom", "lte": "$timeTo"};

    if (this.esVersion >= 2) {
      filter[this.timeField]["format"] = "epoch_millis";
    }

    return filter;
  };

  ElasticQueryBuilder.prototype.buildTermsAgg = function(aggDef, queryNode, target) {
    var metricRef, metric, y;
    queryNode.terms = { "field": aggDef.field };

    if (!aggDef.settings) {
      return queryNode;
    }

    queryNode.terms.size = parseInt(aggDef.settings.size, 10);
    if (aggDef.settings.orderBy !== void 0) {
      queryNode.terms.order = {};
      queryNode.terms.order[aggDef.settings.orderBy] = aggDef.settings.order;

      // if metric ref, look it up and add it to this agg level
      metricRef = parseInt(aggDef.settings.orderBy, 10);
      if (!isNaN(metricRef)) {
        for (y = 0; y < target.metrics.length; y++) {
          metric = target.metrics[y];
          if (metric.id === aggDef.settings.orderBy) {
            queryNode.aggs = {};
            queryNode.aggs[metric.id] = {};
            queryNode.aggs[metric.id][metric.type] = {field: metric.field};
            break;
          }
        }
      }
    }

    return queryNode;
  };

  ElasticQueryBuilder.prototype.getDateHistogramAgg = function(aggDef) {
    var esAgg = {};
    var settings = aggDef.settings || {};
    esAgg.interval = settings.interval;
    esAgg.field = this.timeField;
    esAgg.min_doc_count = settings.min_doc_count || 0;
    esAgg.extended_bounds = {min: "$timeFrom", max: "$timeTo"};

    if (esAgg.interval === 'auto') {
      esAgg.interval = "$interval";
    }

    if (this.esVersion >= 2) {
      esAgg.format = "epoch_millis";
    }

    return esAgg;
  };

  ElasticQueryBuilder.prototype.getFiltersAgg = function(aggDef) {
    var filterObj = {};

    for (var i = 0; i < aggDef.settings.filters.length; i++) {
      var query = aggDef.settings.filters[i].query;
      filterObj[query] = {
        query: {
          query_string: {
            query: query,
            analyze_wildcard: true
          }
        }
      };
    }

    return filterObj;
  };

  ElasticQueryBuilder.prototype.documentQuery = function(query) {
    query.size = 500;
    query.sort = {};
    query.sort[this.timeField] = {order: 'desc', unmapped_type: 'boolean'};
    query.fields = ["*", "_source"];
    query.script_fields = {},
    query.fielddata_fields = [this.timeField];
    return query;
  };

  ElasticQueryBuilder.prototype.build = function(target) {
    // make sure query has defaults;
    target.metrics = target.metrics || [{ type: 'count', id: '1' }];
    target.dsType = 'elasticsearch';
    target.bucketAggs = target.bucketAggs || [{type: 'date_histogram', id: '2', settings: {interval: 'auto'}}];
    target.timeField =  this.timeField;

    var i, nestedAggs, metric;
    var query = {
      "size": 0,
      "query": {
        "filtered": {
          "query": {
            "query_string": {
              "analyze_wildcard": true,
              "query": '$lucene_query',
            }
          },
          "filter": {
            "bool": {
              "must": [{"range": this.getRangeFilter()}]
            }
          }
        }
      }
    };

    // handle document query
    if (target.bucketAggs.length === 0) {
      metric = target.metrics[0];
      if (metric && metric.type !== 'raw_document') {
        throw {message: 'Invalid query'};
      }
      return this.documentQuery(query, target);
    }

    nestedAggs = query;

    for (i = 0; i < target.bucketAggs.length; i++) {
      var aggDef = target.bucketAggs[i];
      var esAgg = {};

      switch(aggDef.type) {
        case 'date_histogram': {
          esAgg["date_histogram"] = this.getDateHistogramAgg(aggDef);
          break;
        }
        case 'filters': {
          esAgg["filters"] = {filters: this.getFiltersAgg(aggDef)};
          break;
        }
        case 'terms': {
          this.buildTermsAgg(aggDef, esAgg, target);
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

      var aggField = {};
      var metricAgg = null;

      if (queryDef.isPipelineAgg(metric)) {
        if (metric.pipelineAgg && /^\d*$/.test(metric.pipelineAgg)) {
          metricAgg = { buckets_path: metric.pipelineAgg };
        } else {
          continue;
        }
      } else {
        metricAgg = {field: metric.field};
      }

      for (var prop in metric.settings) {
        if (metric.settings.hasOwnProperty(prop) && metric.settings[prop] !== null) {
          metricAgg[prop] = metric.settings[prop];
        }
      }

      aggField[metric.type] = metricAgg;
      nestedAggs.aggs[metric.id] = aggField;
    }

    return query;
  };

  ElasticQueryBuilder.prototype.getTermsQuery = function(queryDef) {
    var query = {
      "size": 0,
      "query": {
        "filtered": {
          "query": {
            "query_string": {
              "analyze_wildcard": true,
              "query": '$lucene_query',
            }
          },
          "filter": {
            "bool": {
              "must": [{"range": this.getRangeFilter()}]
            }
          }
        }
      }
    };
    query.aggs =  {
      "1": {
        "terms": {
          "field": queryDef.field,
          "size": 0,
          "order": {
            "_term": "asc"
          }
        },
      }
    };

    return query;
  };

  return ElasticQueryBuilder;
});
