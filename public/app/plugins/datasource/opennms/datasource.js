define([
    'angular',
    'lodash',
    'kbn',
    'moment',
    './queryCtrl',
    './modalCtrl'
  ],
function (angular, _, kbn) {
    'use strict';

    var module = angular.module('grafana.services');

    module.factory('OpenNMSDatasource', function ($q, $http) {

      function OpenNMSDatasource(datasource) {
        this.type = 'opennms';
        this.url = datasource.url;
        this.name = datasource.name;
        this.basicAuth = datasource.basicAuth;
        this.withCredentials = datasource.withCredentials;
        this.searchLimit = 25;

        this.supportMetrics = true;
        this.editorSrc = 'app/features/opennms/partials/query.editor.html';
      }

      // Called once per panel (graph)
      OpenNMSDatasource.prototype.query = function (options) {
        var _this = this;

        // Build the query
        var query = _this._buildQuery(options);

        // Make the request
        var request;
        if (query.source.length > 0) {
          // Only make the request if there is at lease one source
          request = this._onmsRequest('POST', '/rest/measurements', query);
        } else {
          // Otherwise return an empty set of measurements
          request = $q.defer();
          request.resolve({measurements: []});
        }

        // Process the results
        return $q.when(request).then(function (response) {
          return _this._processResponse(response);
        });
      };

      /**
       * Combines all the targets in the panel in a single query,
       * this allows us to make a single round-trip, and take advantage of compression.
       */
      OpenNMSDatasource.prototype._buildQuery = function (options) {
        var _this = this;

        var query = {
          "start": convertToTimestamp(options.range.from),
          "end": convertToTimestamp(options.range.to),
          "step": Math.max(kbn.interval_to_ms(options.interval), 1),
          "maxrows": options.maxDataPoints,
          "source": [],
          "expression": []
        };

        _.each(options.targets, function (target) {
          var transient = "false";
          if (target.hide) {
            transient = true;
          }

          if (target.type === "attribute") {
            if (!((target.nodeId && target.resourceId && target.attribute))) {
              return;
            }

            var label = target.label;
            if (label === undefined) {
              label = target.attribute;
            }

            query.source.push({
              "aggregation": target.aggregation,
              "attribute": target.attribute,
              "label": label,
              "resourceId": _this._getRemoteResourceId(target.nodeId, target.resourceId),
              "transient": transient
            });
          } else if (target.type === "expression") {
            if (!((target.label && target.expression))) {
              return;
            }

            query.expression.push({
              "label": target.label,
              "value": target.expression,
              "transient": transient
            });
          }
        });

        return query;
      };

      OpenNMSDatasource.prototype._processResponse = function (response) {
        var labels = response.labels;
        var columns = response.columns;
        var timestamps = response.timestamps;
        var series = [];
        var i, j, nRows, nCols, datapoints;

        if (timestamps !== undefined) {
          nRows = timestamps.length;
          nCols = columns.length;

          for (i = 0; i < nCols; i++) {
            datapoints = [];
            for (j = 0; j < nRows; j++) {
              // Skip rows that are out-of-ranges - this can happen with RRD data in narrow time spans
              if (timestamps[j] < response.start || timestamps[j] > response.end) {
                continue;
              }

              datapoints.push([columns[i].values[j], timestamps[j]]);
            }

            series.push({
              target: labels[i],
              datapoints: datapoints
            });
          }
        }

        return {data: series };
      };

      function retry(deferred, callback, delay) {
        return callback().then(undefined, function (reason) {
          if (reason.status !== 0 || reason.status >= 300) {
            reason.message = 'OpenNMS Error: <br/>' + reason.data;
            deferred.reject(reason);
          }
          else {
            setTimeout(function () {
              return retry(deferred, callback, Math.min(delay * 2, 30000));
            }, delay);
          }
        });
      }

      OpenNMSDatasource.prototype._onmsRequest = function (method, url, data) {
        var _this = this;

        var deferred = $q.defer();

        retry(deferred, function () {
          var params = {};

          if (method === 'GET') {
            _.extend(params, data);
            data = null;
          }

          var options = {
            method: method,
            url: _this.url + url,
            params: params,
            data: data
          };

          if (_this.basicAuth || _this.withCredentials) {
            options.withCredentials = true;
          }
          if (_this.basicAuth) {
            options.headers = options.headers || {};
            options.headers.Authorization = _this.basicAuth;
          }

          return $http(options).success(function (data) {
            deferred.resolve(data);
          });
        }, 10);

        return deferred.promise;
      };

      function flattenResourcesWithAttributes(resources, resourcesWithAttributes) {
        _.each(resources, function (resource) {
          if (resource.rrdGraphAttributes !== undefined && Object.keys(resource.rrdGraphAttributes).length > 0) {
            resourcesWithAttributes.push(resource);
          }
          if (resource.children !== undefined && resource.children.resource.length > 0) {
            flattenResourcesWithAttributes(resource.children.resource, resourcesWithAttributes);
          }
        });
        return resourcesWithAttributes;
      }

      OpenNMSDatasource.prototype.getResourcesWithAttributesForNode = function (nodeId) {
        return this._onmsRequest('GET', '/rest/resources/fornode/' + encodeURIComponent(nodeId), {
          depth: -1
        }).then(function (root) {
          return flattenResourcesWithAttributes([root], []);
        });
      };

      OpenNMSDatasource.prototype._getRemoteResourceId = function (nodeId, resourceId) {
        var prefix = "";
        if (nodeId.indexOf(":") > 0) {
          prefix = "nodeSource[";
        } else {
          prefix = "node[";
        }
        return prefix + nodeId + "]." + resourceId;
      };

      OpenNMSDatasource.prototype.suggestAttributes = function (nodeId, resourceId, query) {
        return this._onmsRequest('GET', '/rest/resources/' + encodeURIComponent(this._getRemoteResourceId(nodeId, resourceId)), {
          depth: -1
        }).then(function (data) {
          query = query.toLowerCase();

          var attributes = [];
          _.each(data.rrdGraphAttributes, function (value, key) {
            if (key.toLowerCase().indexOf(query) >= 0) {
              attributes.push(key);
            }
          });
          attributes.sort();

          return attributes;
        });
      };

      OpenNMSDatasource.prototype.searchForNodes = function (query) {
        var _this = this;
        return this._onmsRequest('GET', '/rest/nodes', {
          limit: _this.searchLimit,
          match: 'any',
          comparator: 'ilike',
          orderBy: 'id',
          order: 'asc',
          label: '%' + query + '%',
          sysName: '%' + query + '%',
          'ipInterface.ipAddress': '%' + query + '%',
          'ipInterface.ipHostName': '%' + query + '%',
          'foreignId': query + '%' // doesn't support leading '%'
        });
      };

      function convertToTimestamp(date) {
        if (date === 'now') {
          date = new Date();
        } else {
          date = kbn.parseDate(date);
        }
        return date.getTime();
      }

      return OpenNMSDatasource;
    });

  });