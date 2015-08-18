define([
  'angular',
  'lodash',
  'config',
  'kbn',
  'moment',
  './directives'
],
function (angular, _, config, kbn, moment) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('ElasticDatasource', function($q, backendSrv, templateSrv) {

    function ElasticDatasource(datasource) {
      this.type = 'elasticsearch';
      this.basicAuth = datasource.basicAuth;
      this.url = datasource.url;
      this.name = datasource.name;
      this.index = datasource.index;
      this.searchMaxResults = config.search.max_results || 20;

      this.saveTemp = _.isUndefined(datasource.save_temp) ? true : datasource.save_temp;
      this.saveTempTTL = _.isUndefined(datasource.save_temp_ttl) ? '30d' : datasource.save_temp_ttl;
    }

    ElasticDatasource.prototype._request = function(method, url, index, data) {
      var options = {
        url: this.url + "/" + index + url,
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
      return this._request('GET', url, this.index)
        .then(function(results) {
          return results.data;
        });
    };

    ElasticDatasource.prototype._post = function(url, data) {
      return this._request('POST', url, this.index, data)
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

      return this._request('POST', '/_search', annotation.index, data).then(function(results) {
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

    ElasticDatasource.prototype._getDashboardWithSlug = function(id) {
      return this._get('/dashboard/' + kbn.slugifyForUrl(id))
        .then(function(result) {
          return angular.fromJson(result._source.dashboard);
        }, function() {
          throw "Dashboard not found";
        });
    };

    ElasticDatasource.prototype.getDashboard = function(id, isTemp) {
      var url = '/dashboard/' + id;
      if (isTemp) { url = '/temp/' + id; }

      var self = this;
      return this._get(url)
        .then(function(result) {
          return angular.fromJson(result._source.dashboard);
        }, function(data) {
          if(data.status === 0) {
            throw "Could not contact Elasticsearch. Please ensure that Elasticsearch is reachable from your browser.";
          } else {
            // backward compatible fallback
            return self._getDashboardWithSlug(id);
          }
        });
    };

    ElasticDatasource.prototype.saveDashboard = function(dashboard) {
      var title = dashboard.title;
      var temp = dashboard.temp;
      if (temp) { delete dashboard.temp; }

      var data = {
        user: 'guest',
        group: 'guest',
        title: title,
        tags: dashboard.tags,
        dashboard: angular.toJson(dashboard)
      };

      if (temp) {
        return this._saveTempDashboard(data);
      }
      else {

        var id = encodeURIComponent(kbn.slugifyForUrl(title));
        var self = this;

        return this._request('PUT', '/dashboard/' + id, this.index, data)
          .then(function(results) {
            self._removeUnslugifiedDashboard(results, title, id);
            return { title: title, url: '/dashboard/db/' + id };
          }, function() {
            throw 'Failed to save to elasticsearch';
          });
      }
    };

    ElasticDatasource.prototype._removeUnslugifiedDashboard = function(saveResult, title, id) {
      if (saveResult.statusText !== 'Created') { return; }
      if (title === id) { return; }

      var self = this;
      this._get('/dashboard/' + title).then(function() {
        self.deleteDashboard(title);
      });
    };

    ElasticDatasource.prototype._saveTempDashboard = function(data) {
      return this._request('POST', '/temp/?ttl=' + this.saveTempTTL, this.index, data)
        .then(function(result) {

          var baseUrl = window.location.href.replace(window.location.hash,'');
          var url = baseUrl + "#dashboard/temp/" + result.data._id;

          return { title: data.title, url: url };

        }, function(err) {
          throw "Failed to save to temp dashboard to elasticsearch " + err.data;
        });
    };

    ElasticDatasource.prototype.deleteDashboard = function(id) {
      return this._request('DELETE', '/dashboard/' + id, this.index)
        .then(function(result) {
          return result.data._id;
        }, function(err) {
          throw err.data;
        });
    };

    ElasticDatasource.prototype.searchDashboards = function(queryString) {
      var endsInOpen = function(string, opener, closer) {
        var character;
        var count = 0;
        for (var i = 0, len = string.length; i < len; i++) {
          character = string[i];

          if (character === opener) {
            count++;
          } else if (character === closer) {
            count--;
          }
        }

        return count > 0;
      };

      var tagsOnly = queryString.indexOf('tags!:') === 0;
      if (tagsOnly) {
        var tagsQuery = queryString.substring(6, queryString.length);
        queryString = 'tags:' + tagsQuery + '*';
      }
      else {
        if (queryString.length === 0) {
          queryString = 'title:';
        }

        // make this a partial search if we're not in some reserved portion of the language,  comments on conditionals, in order:
        // 1. ends in reserved character, boosting, boolean operator ( -foo)
        // 2. typing a reserved word like AND, OR, NOT
        // 3. open parens (groupiing)
        // 4. open " (term phrase)
        // 5. open [ (range)
        // 6. open { (range)
        // see http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-query-string-query.html#query-string-syntax
        if (!queryString.match(/(\*|\]|}|~|\)|"|^\d+|\s[\-+]\w+)$/) &&
            !queryString.match(/[A-Z]$/) &&
            !endsInOpen(queryString, '(', ')') &&
            !endsInOpen(queryString, '"', '"') &&
            !endsInOpen(queryString, '[', ']') && !endsInOpen(queryString, '[', '}') &&
            !endsInOpen(queryString, '{', ']') && !endsInOpen(queryString, '{', '}')
        ){
          queryString += '*';
        }
      }

      var query = {
        query: { query_string: { query: queryString } },
        facets: { tags: { terms: { field: "tags", order: "term", size: 50 } } },
        size: 10000,
        sort: ["_uid"],
      };

      return this._post('/dashboard/_search', query)
        .then(function(results) {
          if(_.isUndefined(results.hits)) {
            return { dashboards: [], tags: [] };
          }

          var resultsHits = results.hits.hits;
          var displayHits = { dashboards: [], tags: results.facets.tags.terms || [] };

          for (var i = 0, len = resultsHits.length; i < len; i++) {
            var hit = resultsHits[i];
            displayHits.dashboards.push({
              id: hit._id,
              title: hit._source.title,
              tags: hit._source.tags
            });
          }

          displayHits.tagsOnly = tagsOnly;
          return displayHits;
        });
    };

    return ElasticDatasource;

  });

});
