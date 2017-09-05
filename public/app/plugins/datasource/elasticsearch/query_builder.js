define([
  './query_def',
],
function (queryDef) {
  'use strict';

  function ElasticQueryBuilder(options) {
    this.timeField = options.timeField;
    this.esVersion = options.esVersion;
  }

  ElasticQueryBuilder.prototype.getRangeFilter = function() {
    var filter = {};
    filter[this.timeField] = {
      gte: "$timeFrom",
      lte: "$timeTo",
      format: "epoch_millis",
    };

    return filter;
  };

  ElasticQueryBuilder.prototype.buildTermsAgg = function(aggDef, queryNode, target) {
    var metricRef, metric, y;
    queryNode.terms = { "field": aggDef.field };

    if (!aggDef.settings) {
      return queryNode;
    }

    queryNode.terms.size = parseInt(aggDef.settings.size, 10) === 0 ? 500 : parseInt(aggDef.settings.size, 10);
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

    if (aggDef.settings.min_doc_count !== void 0) {
      queryNode.terms.min_doc_count = parseInt(aggDef.settings.min_doc_count, 10);
    }

    if (aggDef.settings.missing) {
      queryNode.terms.missing = aggDef.settings.missing;
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
    esAgg.format = "epoch_millis";

    if (esAgg.interval === 'auto') {
      esAgg.interval = "$__interval";
    }

    if (settings.missing) {
      esAgg.missing = settings.missing;
    }

    return esAgg;
  };

  ElasticQueryBuilder.prototype.getHistogramAgg = function(aggDef) {
    var esAgg = {};
    var settings = aggDef.settings || {};
    esAgg.interval = settings.interval;
    esAgg.field = aggDef.field;
    esAgg.min_doc_count = settings.min_doc_count || 0;

    if (settings.missing) {
      esAgg.missing = settings.missing;
    }
    return esAgg;
  };

  ElasticQueryBuilder.prototype.getFiltersAgg = function(aggDef) {
    var filterObj = {};
    for (var i = 0; i < aggDef.settings.filters.length; i++) {
      var query = aggDef.settings.filters[i].query;
      var label = aggDef.settings.filters[i].label;
      label = label === '' || label === undefined ? query : label;
      filterObj[label] = {
        query_string: {
          query: query,
          analyze_wildcard: true
        }
      };
    }

    return filterObj;
  };

  ElasticQueryBuilder.prototype.documentQuery = function(query, size) {
    query.size = size;
    query.sort = {};
    query.sort[this.timeField] = {order: 'desc', unmapped_type: 'boolean'};

    // fields field not supported on ES 5.x
    if (this.esVersion < 5) {
      query.fields = ["*", "_source"];
    }

    query.script_fields = {};
    if (this.esVersion < 5) {
      query.fielddata_fields = [this.timeField];
    } else {
      query.docvalue_fields = [this.timeField];
    }
    return query;
  };

  ElasticQueryBuilder.prototype.addAdhocFilters = function(query, adhocFilters) {
    if (!adhocFilters) {
      return;
    }

    var i, filter, condition, queryCondition;

    for (i = 0; i < adhocFilters.length; i++) {
      filter = adhocFilters[i];
      condition = {};
      condition[filter.key] = filter.value;
      queryCondition = {};
      queryCondition[filter.key] = {query: filter.value};

      switch(filter.operator){
        case "=":
          if (!query.query.bool.must) { query.query.bool.must = []; }
          query.query.bool.must.push({match_phrase: queryCondition});
          break;
        case "!=":
          if (!query.query.bool.must_not) { query.query.bool.must_not = []; }
          query.query.bool.must_not.push({match_phrase: queryCondition});
          break;
        case "<":
          condition[filter.key] = {"lt": filter.value};
          query.query.bool.filter.push({"range": condition});
          break;
        case ">":
          condition[filter.key] = {"gt": filter.value};
          query.query.bool.filter.push({"range": condition});
          break;
        case "=~":
          query.query.bool.filter.push({"regexp": condition});
          break;
        case "!~":
          query.query.bool.filter.push({"bool": {"must_not": {"regexp": condition}}});
          break;
      }
    }
  };

  ElasticQueryBuilder.prototype.build = function(target, adhocFilters, queryString) {
    // make sure query has defaults;
    target.metrics = target.metrics || [{ type: 'count', id: '1' }];
    target.dsType = 'elasticsearch';
    target.bucketAggs = target.bucketAggs || [{type: 'date_histogram', id: '2', settings: {interval: 'auto'}}];
    target.timeField =  this.timeField;

    var i, nestedAggs, metric;
    var query = {
      "size": 0,
      "query": {
        "bool": {
          "filter": [
            {"range": this.getRangeFilter()},
            {
              "query_string": {
                "analyze_wildcard": true,
                "query": queryString,
              }
            }
          ]
        }
      }
    };

    this.addAdhocFilters(query, adhocFilters);

    // handle document query
    if (target.bucketAggs.length === 0) {
      metric = target.metrics[0];
      if (!metric || metric.type !== 'raw_document') {
        throw {message: 'Invalid query'};
      }

      var size = (metric.settings && metric.settings.size) || 500;
      return this.documentQuery(query, size);
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
        case 'histogram': {
          esAgg["histogram"] = this.getHistogramAgg(aggDef);
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
        case 'geohash_grid': {
          esAgg['geohash_grid'] = {field: aggDef.field, precision: aggDef.settings.precision};
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

      if (queryDef.isPipelineAgg(metric.type)) {
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
        "bool": {
          "filter": [{"range": this.getRangeFilter()}]
        }
      }
    };

    if (queryDef.query) {
      query.query.bool.filter.push({
        "query_string": {
          "analyze_wildcard": true,
          "query": queryDef.query,
        }
      });
    }

    var size = 500;
    if (queryDef.size) {
      size = queryDef.size;
    }

    query.aggs =  {
      "1": {
        "terms": {
          "field": queryDef.field,
          "size": size,
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
