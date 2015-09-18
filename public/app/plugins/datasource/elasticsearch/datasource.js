define([
  'angular',
  'lodash',
  'moment',
  'kbn',
  './queryBuilder',
  './indexPattern',
  './elasticResponse',
  './queryCtrl',
  './directives'
],
function (angular, _, moment, kbn, ElasticQueryBuilder, IndexPattern, ElasticResponse) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('ElasticDatasource', function($q, backendSrv, templateSrv) {

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

    ElasticDatasource.prototype.annotationQuery = function(annotation, rangeUnparsed) {
      var range = {};
      var timeField = annotation.timeField || '@timestamp';
      var queryString = annotation.query || '*';
      var tagsField = annotation.tagsField || 'tags';
      var titleField = annotation.titleField || 'desc';
      var textField = annotation.textField || null;

      range[timeField]= {
        from: rangeUnparsed.from,
        to: rangeUnparsed.to,
      };

      var queryInterpolated = templateSrv.replace(queryString);
      var filter = { "bool": { "must": [{ "range": range }] } };
      var query = { "bool": { "should": [{ "query_string": { "query": queryInterpolated } }] } };
      var data = {
        "fields": [timeField, "_source"],
        "query" : { "filtered": { "query" : query, "filter": filter } },
        "size": 10000
      };

      return this._request('POST', annotation.index + '/_search', data).then(function(results) {
        var list = [];
        var hits = results.data.hits.hits;

        var getFieldFromSource = function(source, fieldName) {
          if (!fieldName) { return; }

          var fieldNames = fieldName.split('.');
          var fieldValue = source;

          for (var i = 0; i < fieldNames.length; i++) {
            fieldValue = fieldValue[fieldNames[i]];
            if (!fieldValue) {
              console.log('could not find field in annotatation: ', fieldName);
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

    ElasticDatasource.prototype.getQueryHeader = function(timeRange) {
      var header = {search_type: "count", "ignore_unavailable": true};
      var from = kbn.parseDate(timeRange.from);
      var to = kbn.parseDate(timeRange.to);
      header.index = this.indexPattern.getIndexList(from, to);
      return angular.toJson(header);
    };

    ElasticDatasource.prototype.query = function(options) {
      var payload = "";
      var target;
      var sentTargets = [];

      var header = this.getQueryHeader(options.range);
      var timeFrom = this.translateTime(options.range.from);
      var timeTo = this.translateTime(options.range.to);

      for (var i = 0; i < options.targets.length; i++) {
        target = options.targets[i];
        if (target.hide) {return;}

        var esQuery = this.queryBuilder.build(target, timeFrom, timeTo);
        payload += header + '\n';
        payload += angular.toJson(esQuery) + '\n';

        sentTargets.push(target);
      }

      payload = payload.replace(/\$interval/g, options.interval);
      payload = payload.replace(/\$timeFrom/g, this.translateTime(options.range.from));
      payload = payload.replace(/\$timeTo/g, this.translateTime(options.range.to));
      payload = payload.replace(/\$maxDataPoints/g, options.maxDataPoints);
      payload = templateSrv.replace(payload, options.scopedVars);

      return this._post('/_msearch?search_type=count', payload).then(function(res) {
        return new ElasticResponse(sentTargets, res).getTimeSeries();
      });
    };

    ElasticDatasource.prototype.translateTime = function(date) {
      if (_.isString(date)) {
        return date;
      }

      return date.getTime();
    };

    ElasticDatasource.prototype.metricFindQuery = function() {
      return this._get('/_mapping').then(function(res) {
        var fields = {};

        for (var indexName in res) {
          var index = res[indexName];
          var mappings = index.mappings;
          if (!mappings) { continue; }
          for (var typeName in mappings) {
            var properties = mappings[typeName].properties;
            for (var field in properties) {
              var prop = properties[field];
              if (prop.type && field[0] !== '_') {
                fields[field] = prop;
              }
            }
          }
        }

        fields = _.map(_.keys(fields), function(field) {
          return {text: field};
        });

        return fields;
      });
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
