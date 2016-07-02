define([
  'angular',
  'lodash',
  'moment',
  'app/core/utils/kbn',
  './query_builder',
  './index_pattern',
  './elastic_response',
  './query_ctrl',
],
function (angular, _, moment, kbn, ElasticQueryBuilder, IndexPattern, ElasticResponse) {
  'use strict';

  /** @ngInject */
  function ElasticDatasource(instanceSettings, $q, backendSrv, templateSrv, timeSrv) {
    this.basicAuth = instanceSettings.basicAuth;
    this.withCredentials = instanceSettings.withCredentials;
    this.url = instanceSettings.url;
    this.name = instanceSettings.name;
    this.index = instanceSettings.index;
    this.timeField = instanceSettings.jsonData.timeField;
    this.esVersion = instanceSettings.jsonData.esVersion;
    this.indexPattern = new IndexPattern(instanceSettings.index, instanceSettings.jsonData.interval);
    this.interval = instanceSettings.jsonData.timeInterval;
    this.queryBuilder = new ElasticQueryBuilder({
      timeField: this.timeField,
      esVersion: this.esVersion,
    });

    this._request = function(method, url, data) {
      var options = {
        url: this.url + "/" + url,
        method: method,
        data: data
      };

      if (this.basicAuth || this.withCredentials) {
        options.withCredentials = true;
      }
      if (this.basicAuth) {
        options.headers = {
          "Authorization": this.basicAuth
        };
      }

      return backendSrv.datasourceRequest(options);
    };

    this._get = function(url) {
      return this._request('GET', this.indexPattern.getIndexForToday() + url).then(function(results) {
        results.data.$$config = results.config;
        return results.data;
      });
    };

    this._post = function(url, data) {
      return this._request('POST', url, data).then(function(results) {
        results.data.$$config = results.config;
        return results.data;
      });
    };

    this.annotationQuery = function(options) {
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

      if (this.esVersion >= 2) {
        range[timeField]["format"] = "epoch_millis";
      }

      var queryInterpolated = templateSrv.replace(queryString, {}, 'lucene');
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

      return this._post('_msearch', payload).then(function(res) {
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

    this.testDatasource = function() {
      return this._get('/_stats').then(function() {
        return { status: "success", message: "Data source is working", title: "Success" };
      }, function(err) {
        if (err.data && err.data.error) {
          return { status: "error", message: angular.toJson(err.data.error), title: "Error" };
        } else {
          return { status: "error", message: err.status, title: "Error" };
        }
      });
    };

    this.getQueryHeader = function(searchType, timeFrom, timeTo) {
      var header = {search_type: searchType, "ignore_unavailable": true};
      header.index = this.indexPattern.getIndexList(timeFrom, timeTo);
      return angular.toJson(header);
    };

    this.query = function(options) {
      var payload = "";
      var target;
      var sentTargets = [];

      for (var i = 0; i < options.targets.length; i++) {
        target = options.targets[i];
        if (target.hide) {continue;}

        var queryObj = this.queryBuilder.build(target);
        var esQuery = angular.toJson(queryObj);
        var luceneQuery = target.query || '*';
        luceneQuery = templateSrv.replace(luceneQuery, options.scopedVars, 'lucene');
        luceneQuery = angular.toJson(luceneQuery);

        // remove inner quotes
        luceneQuery = luceneQuery.substr(1, luceneQuery.length - 2);
        esQuery = esQuery.replace("$lucene_query", luceneQuery);

        var searchType = queryObj.size === 0 ? 'count' : 'query_then_fetch';
        var header = this.getQueryHeader(searchType, options.range.from, options.range.to);
        payload +=  header + '\n';

        payload += esQuery + '\n';
        sentTargets.push(target);
      }

      if (sentTargets.length === 0) {
        return $q.when([]);
      }

      payload = payload.replace(/\$interval/g, options.interval);
      payload = payload.replace(/\$timeFrom/g, options.range.from.valueOf());
      payload = payload.replace(/\$timeTo/g, options.range.to.valueOf());
      payload = templateSrv.replace(payload, options.scopedVars);

      return this._post('_msearch', payload).then(function(res) {
        return new ElasticResponse(sentTargets, res).getTimeSeries();
      });
    };

    function escapeForJson(value) {
      var luceneQuery = JSON.stringify(value);
      return luceneQuery.substr(1, luceneQuery.length - 2);
    }

    this.getFields = function(query) {
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

    this.getTerms = function(queryDef) {
      var range = timeSrv.timeRange();
      var header = this.getQueryHeader('count', range.from, range.to);
      var esQuery = angular.toJson(this.queryBuilder.getTermsQuery(queryDef));

      esQuery = esQuery.replace("$lucene_query", escapeForJson(queryDef.query));
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

    this.metricFindQuery = function(query) {
      query = angular.fromJson(query);
      query.query = templateSrv.replace(query.query || '*', {}, 'lucene');

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
  }

  return {
    ElasticDatasource: ElasticDatasource
  };
});
