define([
  'angular',
  'lodash',
  'kbn',
  './influxSeries',
  './queryBuilder',
  './queryCtrl',
  './funcEditor',
],
function (angular, _, kbn, InfluxSeries, InfluxQueryBuilder) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('InfluxDatasource_08', function($q, backendSrv, templateSrv) {

    function InfluxDatasource(datasource) {
      this.urls = _.map(datasource.url.split(','), function(url) {
        return url.trim();
      });

      this.username = datasource.username;
      this.password = datasource.password;
      this.name = datasource.name;
      this.basicAuth = datasource.basicAuth;
    }

    InfluxDatasource.prototype.query = function(options) {
      var timeFilter = getTimeFilter(options);

      var promises = _.map(options.targets, function(target) {
        if (target.hide || !((target.series && target.column) || target.query)) {
          return [];
        }

        // build query
        var queryBuilder = new InfluxQueryBuilder(target);
        var query = queryBuilder.build();

        // replace grafana variables
        query = query.replace('$timeFilter', timeFilter);
        query = query.replace(/\$interval/g, (target.interval || options.interval));

        // replace templated variables
        query = templateSrv.replace(query);

        var alias = target.alias ? templateSrv.replace(target.alias) : '';

        var handleResponse = _.partial(handleInfluxQueryResponse, alias, queryBuilder.groupByField);
        return this._seriesQuery(query).then(handleResponse);

      }, this);

      return $q.all(promises).then(function(results) {
        return { data: _.flatten(results) };
      });
    };

    InfluxDatasource.prototype.annotationQuery = function(annotation, rangeUnparsed) {
      var timeFilter = getTimeFilter({ range: rangeUnparsed });
      var query = annotation.query.replace('$timeFilter', timeFilter);
      query = templateSrv.replace(query);

      return this._seriesQuery(query).then(function(results) {
        return new InfluxSeries({ seriesList: results, annotation: annotation }).getAnnotations();
      });
    };

    InfluxDatasource.prototype.listColumns = function(seriesName) {
      seriesName = templateSrv.replace(seriesName);

      if(!seriesName.match('^/.*/') && !seriesName.match(/^merge\(.*\)/)) {
        seriesName = '"' + seriesName+ '"';
      }

      return this._seriesQuery('select * from ' + seriesName + ' limit 1').then(function(data) {
        if (!data) {
          return [];
        }
        return data[0].columns.map(function(item) {
          return /^\w+$/.test(item) ? item : ('"' + item + '"');
        });
      });
    };

    InfluxDatasource.prototype.listSeries = function(query) {
      // wrap in regex
      if (query && query.length > 0 && query[0] !== '/')  {
        query = '/' + query + '/';
      }

      return this._seriesQuery('list series ' + query).then(function(data) {
        if (!data || data.length === 0) {
          return [];
        }
        return _.map(data[0].points, function(point) {
          return point[1];
        });
      });
    };

    InfluxDatasource.prototype.metricFindQuery = function (query) {
      var interpolated;
      try {
        interpolated = templateSrv.replace(query);
      }
      catch (err) {
        return $q.reject(err);
      }

      return this._seriesQuery(interpolated)
        .then(function (results) {
          if (!results || results.length === 0) { return []; }

          return _.map(results[0].points, function (metric) {
            return {
              text: metric[1],
              expandable: false
            };
          });
        });
    };

    function retry(deferred, callback, delay) {
      return callback().then(undefined, function(reason) {
        if (reason.status !== 0 || reason.status >= 300) {
          reason.message = 'InfluxDB Error: <br/>' + reason.data;
          deferred.reject(reason);
        }
        else {
          setTimeout(function() {
            return retry(deferred, callback, Math.min(delay * 2, 30000));
          }, delay);
        }
      });
    }

    InfluxDatasource.prototype._seriesQuery = function(query) {
      return this._influxRequest('GET', '/series', {
        q: query,
      });
    };

    InfluxDatasource.prototype._influxRequest = function(method, url, data) {
      var _this = this;
      var deferred = $q.defer();

      retry(deferred, function() {
        var currentUrl = _this.urls.shift();
        _this.urls.push(currentUrl);

        var params = {
          u: _this.username,
          p: _this.password,
        };

        if (method === 'GET') {
          _.extend(params, data);
          data = null;
        }

        var options = {
          method: method,
          url:    currentUrl + url,
          params: params,
          data:   data,
          inspect: { type: 'influxdb' },
        };

        options.headers = options.headers || {};
        if (_this.basicAuth) {
          options.headers.Authorization = 'Basic ' + _this.basicAuth;
        }

        return backendSrv.datasourceRequest(options).then(function(response) {
          deferred.resolve(response.data);
        });
      }, 10);

      return deferred.promise;
    };

    InfluxDatasource.prototype._getDashboardInternal = function(id, isTemp) {
      var queryString = 'select dashboard from "grafana.dashboard_' + btoa(id) + '"';

      if (isTemp) {
        queryString = 'select dashboard from "grafana.temp_dashboard_' + btoa(id) + '"';
      }

      return this._seriesQuery(queryString).then(function(results) {
        if (!results || !results.length) {
          return null;
        }

        var dashCol = _.indexOf(results[0].columns, 'dashboard');
        var dashJson = results[0].points[0][dashCol];

        return angular.fromJson(dashJson);
      }, function() {
        return null;
      });
    };

    InfluxDatasource.prototype.getDashboard = function(id, isTemp) {
      var self = this;
      return this._getDashboardInternal(id, isTemp).then(function(dashboard) {
        if (dashboard !== null)  {
          return dashboard;
        }

        // backward compatible load for unslugified ids
        var slug = kbn.slugifyForUrl(id);
        if (slug !== id) {
          return self.getDashboard(slug, isTemp);
        }

        throw "Dashboard not found";
      }, function(err) {
        throw  "Could not load dashboard, " + err.data;
      });
    };

    InfluxDatasource.prototype.deleteDashboard = function(id) {
      return this._seriesQuery('drop series "grafana.dashboard_' + btoa(id) + '"').then(function(results) {
        if (!results) {
          throw "Could not delete dashboard";
        }
        return id;
      }, function(err) {
        throw "Could not delete dashboard, " + err.data;
      });
    };

    InfluxDatasource.prototype.searchDashboards = function(queryString) {
      var influxQuery = 'select * from /grafana.dashboard_.*/ where ';

      var tagsOnly = queryString.indexOf('tags!:') === 0;
      if (tagsOnly) {
        var tagsQuery = queryString.substring(6, queryString.length);
        influxQuery = influxQuery + 'tags =~ /.*' + tagsQuery + '.*/i';
      }
      else {
        var titleOnly = queryString.indexOf('title:') === 0;
        if (titleOnly) {
          var titleQuery = queryString.substring(6, queryString.length);
          influxQuery = influxQuery + ' title =~ /.*' + titleQuery + '.*/i';
        }
        else {
          influxQuery = influxQuery + '(tags =~ /.*' + queryString + '.*/i or title =~ /.*' + queryString + '.*/i)';
        }
      }

      return this._seriesQuery(influxQuery).then(function(results) {
        var hits = { dashboards: [], tags: [], tagsOnly: false };

        if (!results || !results.length) {
          return hits;
        }

        for (var i = 0; i < results.length; i++) {
          var dashCol = _.indexOf(results[i].columns, 'title');
          var tagsCol = _.indexOf(results[i].columns, 'tags');
          var idCol = _.indexOf(results[i].columns, 'id');

          var hit =  {
            id: results[i].points[0][dashCol],
            title: results[i].points[0][dashCol],
            tags: results[i].points[0][tagsCol].split(",")
          };

          if (idCol !== -1) {
            hit.id = results[i].points[0][idCol];
          }

          hit.tags = hit.tags[0] ? hit.tags : [];
          hits.dashboards.push(hit);
        }
        return hits;
      });
    };

    function handleInfluxQueryResponse(alias, groupByField, seriesList) {
      var influxSeries = new InfluxSeries({
        seriesList: seriesList,
        alias: alias,
        groupByField: groupByField
      });

      return influxSeries.getTimeSeries();
    }

    function getTimeFilter(options) {
      var from = getInfluxTime(options.range.from);
      var until = getInfluxTime(options.range.to);
      var fromIsAbsolute = from[from.length-1] === 's';

      if (until === 'now()' && !fromIsAbsolute) {
        return 'time > ' + from;
      }

      return 'time > ' + from + ' and time < ' + until;
    }

    function getInfluxTime(date) {
      if (_.isString(date)) {
        return date.replace('now', 'now()');
      }

      return to_utc_epoch_seconds(date);
    }

    function to_utc_epoch_seconds(date) {
      return (date.getTime() / 1000).toFixed(0) + 's';
    }

    return InfluxDatasource;

  });

});
