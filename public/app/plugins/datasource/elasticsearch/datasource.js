define([
  'angular',
  'lodash',
  'moment',
  'app/core/utils/kbn',
  './query_builder',
  './index_pattern',
  './elastic_response',
  './query_ctrl',
  './directives'
],
function (angular, _, moment, kbn, ElasticQueryBuilder, IndexPattern, ElasticResponse) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('ElasticDatasource', function($q, backendSrv, templateSrv, timeSrv) {

    function ElasticDatasource(datasource) {
      this.type = 'elasticsearch';
      this.basicAuth = datasource.basicAuth;
      this.url = datasource.url;
      this.name = datasource.name;
      this.index = datasource.index;
      this.timeField = datasource.jsonData.timeField;
      this.indexPattern = new IndexPattern(datasource.index, datasource.jsonData.interval);
      this.queryBuilder = new ElasticQueryBuilder({
        timeField: this.timeField
      });
    }

    ElasticDatasource.prototype._request = function(method, url, data) {
      var options = {
        url: this.url + "/" + url,
        method: method,
        data: data
      };

      if (this.basicAuth) {
        options.withCredentials = true;
        options.headers = {
          "Authorization": this.basicAuth
        };
      }

      return backendSrv.datasourceRequest(options);
    };

    ElasticDatasource.prototype._get = function(url) {
      return this._request('GET', this.indexPattern.getIndexForToday() + url)
        .then(function(results) {
          return results.data;
        });
    };

    ElasticDatasource.prototype._post = function(url, data) {
      return this._request('POST', url, data)
        .then(function(results) {
          return results.data;
        });
    };

    ElasticDatasource.prototype.annotationQuery = function(options) {
      var annotation = options.annotation;
      var timeField = annotation.timeField || '@timestamp';
      var queryString = annotation.query || '*';
      var tagsField = annotation.tagsField || 'tags';
      var titleField = annotation.titleField || 'desc';
      var textField = annotation.textField || null;

      var range = {};
      range[timeField]= {
        from: options.range.from.valueOf(),
        to: options.range.to.valueOf(),
      };

      var queryInterpolated = templateSrv.replace(queryString);
      var filter = { "bool": { "must": [{ "range": range }] } };
      var query = { "bool": { "should": [{ "query_string": { "query": queryInterpolated } }] } };
      var data = {
        "fields": [timeField, "_source"],
        "query" : { "filtered": { "query" : query, "filter": filter } },
        "size": 10000
      };

      var header = {search_type: "query_then_fetch", "ignore_unavailable": true};

      // old elastic annotations had index specified on them
      if (annotation.index) {
        header.index = annotation.index;
      } else {
        header.index = this.indexPattern.getIndexList(options.range.from, options.range.to);
      }

      var payload = angular.toJson(header) + '\n' + angular.toJson(data) + '\n';

      return this._post('/_msearch', payload).then(function(res) {
        var list = [];
        var hits = res.responses[0].hits.hits;

        var getFieldFromSource = function(source, fieldName) {
          if (!fieldName) { return; }

          var fieldNames = fieldName.split('.');
          var fieldValue = source;

          for (var i = 0; i < fieldNames.length; i++) {
            fieldValue = fieldValue[fieldNames[i]];
            if (!fieldValue) {
              console.log('could not find field in annotation: ', fieldName);
              return '';
            }
          }

          if (_.isArray(fieldValue)) {
            fieldValue = fieldValue.join(', ');
          }
          return fieldValue;
        };

        for (var i = 0; i < hits.length; i++) {
          var source = hits[i]._source;
          var fields = hits[i].fields;
          var time = source[timeField];

          if (_.isString(fields[timeField]) || _.isNumber(fields[timeField])) {
            time = fields[timeField];
          }

          var event = {
            annotation: annotation,
            time: moment.utc(time).valueOf(),
            title: getFieldFromSource(source, titleField),
            tags: getFieldFromSource(source, tagsField),
            text: getFieldFromSource(source, textField)
          };

          list.push(event);
        }
        return list;
      });
    };

    ElasticDatasource.prototype.testDatasource = function() {
      return this._get('/_stats').then(function() {
        return { status: "success", message: "Data source is working", title: "Success" };
      }, function(err) {
        if (err.data && err.data.error) {
          return { status: "error", message: err.data.error, title: "Error" };
        } else {
          return { status: "error", message: err.status, title: "Error" };
        }
      });
    };

    ElasticDatasource.prototype.getQueryHeader = function(searchType, timeFrom, timeTo) {
      var header = {search_type: searchType, "ignore_unavailable": true};
      header.index = this.indexPattern.getIndexList(timeFrom, timeTo);
      return angular.toJson(header);
    };

    ElasticDatasource.prototype.query = function(options) {
      var payload = "";
      var target;
      var sentTargets = [];

      for (var i = 0; i < options.targets.length; i++) {
        target = options.targets[i];
        if (target.hide) {continue;}

        var queryObj = this.queryBuilder.build(target);
        var esQuery = angular.toJson(queryObj);
        var luceneQuery = angular.toJson(target.query || '*');
        // remove inner quotes
        luceneQuery = luceneQuery.substr(1, luceneQuery.length - 2);
        esQuery = esQuery.replace("$lucene_query", luceneQuery);

        var searchType = queryObj.size === 0 ? 'count' : 'query_then_fetch';
        var header = this.getQueryHeader(searchType, options.range.from, options.range.to);
        payload +=  header + '\n';

        payload += esQuery + '\n';
        sentTargets.push(target);
      }

      payload = payload.replace(/\$interval/g, options.interval);
      payload = payload.replace(/\$timeFrom/g, options.range.from.valueOf());
      payload = payload.replace(/\$timeTo/g, options.range.to.valueOf());
      payload = templateSrv.replace(payload, options.scopedVars);

      return this._post('/_msearch', payload).then(function(res) {
        return new ElasticResponse(sentTargets, res).getTimeSeries();
      });
    };

    ElasticDatasource.prototype.getFields = function(query) {
      return this._get('/_mapping').then(function(res) {
        var fields = {};
        var typeMap = {
          'float': 'number',
          'double': 'number',
          'integer': 'number',
          'long': 'number',
          'date': 'date',
          'string': 'string',
        };

        for (var indexName in res) {
          var index = res[indexName];
          var mappings = index.mappings;
          if (!mappings) { continue; }
          for (var typeName in mappings) {
            var properties = mappings[typeName].properties;
            for (var field in properties) {
              var prop = properties[field];
              if (query.type && typeMap[prop.type] !== query.type) {
                continue;
              }
              if (prop.type && field[0] !== '_') {
                fields[field] = {text: field, type: prop.type};
              }
            }
          }
        }

        // transform to array
        return _.map(fields, function(value) {
          return value;
        });
      });
    };

    ElasticDatasource.prototype.getTerms = function(queryDef) {
      var range = timeSrv.timeRange();
      var header = this.getQueryHeader('count', range.from, range.to);
      var esQuery = angular.toJson(this.queryBuilder.getTermsQuery(queryDef));

      esQuery = esQuery.replace("$lucene_query", queryDef.query || '*');
      esQuery = esQuery.replace(/\$timeFrom/g, range.from.valueOf());
      esQuery = esQuery.replace(/\$timeTo/g, range.to.valueOf());
      esQuery = header + '\n' + esQuery + '\n';

      return this._post('/_msearch?search_type=count', esQuery).then(function(res) {
        var buckets = res.responses[0].aggregations["1"].buckets;
        return _.map(buckets, function(bucket) {
          return {text: bucket.key, value: bucket.key};
        });
      });
    };

    ElasticDatasource.prototype.metricFindQuery = function(query) {
      query = templateSrv.replace(query);
      query = angular.fromJson(query);
      if (!query) {
        return $q.when([]);
      }

      if (query.find === 'fields') {
        return this.getFields(query);
      }
      if (query.find === 'terms') {
        return this.getTerms(query);
      }
    };

    ElasticDatasource.prototype.getDashboard = function(id) {
      return this._get('/dashboard/' + id)
      .then(function(result) {
        return angular.fromJson(result._source.dashboard);
      });
    };

    ElasticDatasource.prototype.searchDashboards = function() {
      var query = {
        query: { query_string: { query: '*' } },
        size: 10000,
        sort: ["_uid"],
      };

      return this._post(this.index + '/dashboard/_search', query)
      .then(function(results) {
        if(_.isUndefined(results.hits)) {
          return { dashboards: [], tags: [] };
        }

        var resultsHits = results.hits.hits;
        var displayHits = { dashboards: [] };

        for (var i = 0, len = resultsHits.length; i < len; i++) {
          var hit = resultsHits[i];
          displayHits.dashboards.push({
            id: hit._id,
            title: hit._source.title,
            tags: hit._source.tags
          });
        }

        return displayHits;
      });
    };

    return ElasticDatasource;
  });
});
