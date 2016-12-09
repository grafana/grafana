define([
  'angular',
  'lodash',
  'moment',
  'app/core/utils/datemath',
  './directives',
  './query_ctrl',
],
function (angular, _, moment, dateMath) {
  'use strict';

  var module = angular.module('grafana.services');

  module.config(function($httpProvider) {
    //Enable cross domain calls
    $httpProvider.defaults.useXDomain = true;
  });

  module.factory('GnocchiDatasource', function($q, backendSrv, templateSrv) {

    function GnocchiDatasource(datasource) {
      this.type = 'gnocchi';
      this.supportMetrics = true;
      this.name = datasource.name;

      this.default_headers = {
        'Content-Type': 'application/json',
      };

      if (datasource.jsonData) {
        this.project = datasource.jsonData.project;
        this.username = datasource.jsonData.username;
        this.password = datasource.jsonData.password;
        this.default_headers['X-Auth-Token'] = datasource.jsonData.token;
      }

      // If the URL starts with http, we are in direct mode
      if (datasource.url.indexOf('http') === 0){
        this.url = null;
        this.keystone_endpoint = sanitize_url(datasource.url);
      } else {
        this.url = sanitize_url(datasource.url);
        this.keystone_endpoint = null;
      }
    }

    ////////////////
    // Plugins API
    ////////////////

    GnocchiDatasource.prototype.query = function(options) {
      var _this = this;
      var promises = _.map(options.targets, function(target) {
        // Ensure target is valid
        var default_measures_req = {
          params: {
            'aggregation': target.aggregator,
            'start': options.range.from.toISOString()
          }
        };
        if (options.range.to){
          default_measures_req.params.end = options.range.to.toISOString();
        }

        var error = _this.validateTarget(target, true);
        if(error) {
          // no need to $q.reject() here, error is already printed by the queryCtrl
          console.log("target is not yet valid: " + error);
          return $q.when([]);
        }
        var metric_name;
        var resource_search;
        var resource_type;
        var resource_id;
        var metric_id;
        var label;

        try {
          metric_name = templateSrv.replace(target.metric_name);
          resource_search = templateSrv.replace(target.resource_search);
          resource_type = templateSrv.replace(target.resource_type);
          resource_id = templateSrv.replace(target.resource_id);
          metric_id = templateSrv.replace(target.metric_id);
          label = templateSrv.replace(target.label);
        } catch (err) {
          return $q.reject(err);
        }

        resource_type = resource_type || "generic";

        if (target.queryMode === "resource_search") {
          var resource_search_req = {
            url: 'v1/search/resource/' + resource_type,
            method: 'POST',
            data: resource_search
          };
          return _this._gnocchi_request(resource_search_req).then(function(result) {
            return $q.all(_.map(result, function(resource) {
              var measures_req = _.merge({}, default_measures_req);
              measures_req.url = ('v1/resource/' + resource_type +
                                  '/' + resource["id"] + '/metric/' + metric_name + '/measures');
              return _this._retrieve_measures(resource[label] || label, measures_req);
            }));
          });
        } else if (target.queryMode === "resource_aggregation") {
          default_measures_req.url = ('v1/aggregation/resource/' +
                                      resource_type + '/metric/' + metric_name);
          default_measures_req.method = 'POST';
          default_measures_req.data = target.resource_search;
          return _this._retrieve_measures(label || "unlabeled", default_measures_req);

        } else if (target.queryMode === "resource") {
          var resource_req = {
            url: 'v1/resource/' + resource_type+ '/' + resource_id,
            method: 'GET'
          };

          return _this._gnocchi_request(resource_req).then(function(resource) {
            label = resource[label] || label;
            if (!label) { label = resource_id ; }
            default_measures_req.url = ('v1/resource/' + resource_type+ '/' +
                                        resource_id + '/metric/' + metric_name+ '/measures');
            return _this._retrieve_measures(label, default_measures_req);
          });
        } else if (target.queryMode === "metric") {
          default_measures_req.url = 'v1/metric/' + metric_id + '/measures';
          return _this._retrieve_measures(metric_id, default_measures_req);
        }
      });

      return $q.all(promises).then(function(results) {
        return { data: _.flatten(results) };
      });
    };

    GnocchiDatasource.prototype._retrieve_measures = function(name, reqs) {
      return this._gnocchi_request(reqs).then(function(result) {
        var dps = [];
        _.each(result.sort(), function(metricData) {
          dps.push([metricData[2], dateMath.parse(metricData[0]).valueOf()]);
        });
        return { target: name, datapoints: dps };
      });
    };

    GnocchiDatasource.prototype.performSuggestQuery = function(query, type, target) {
      var options = {};
      var attribute = "id";
      var getter = function(result) {
        return _.map(result, function(item) {
          return item[attribute];
        });
      };

      if (type === 'metrics') {
        options.url = 'v1/metric';

      } else if (type === 'resources') {
        options.url = 'v1/resource/generic';

      } else if (type === 'metric_names') {
        if (target.queryMode === "resource" && target.resource_id !== "") {
          options.url = 'v1/resource/generic/' + target.resource_id;
          getter = function(result) {
            return Object.keys(result["metrics"]);
          };
        } else{
          return $q.when([]);
        }
      } else {
        return $q.when([]);
      }
      return this._gnocchi_request(options).then(getter);
    };

    GnocchiDatasource.prototype.metricFindQuery = function(query) {
      var req = { method: 'POST' };
      var resourceQuery = query.match(/^resources\(([^,]*),\s?([^,]*),\s?([^\)]+?)\)/);
      if (resourceQuery) {
        try {
          // Ensure this is json
          req.data = templateSrv.replace(angular.toJson(angular.fromJson(resourceQuery[3])));
          req.url = templateSrv.replace('v1/search/resource/' + resourceQuery[1]);
        } catch (err) {
          return $q.reject(err);
        }
        return this._gnocchi_request(req).then(function(result) {
          return _.map(result, function(resource) {
            return { text: resource[resourceQuery[2]] };
          });
        });
      }

      var metricsQuery = query.match(/^metrics\(([^\)]+?)\)/);
      if (metricsQuery) {
        try {
          req.method = 'GET';
          req.url = 'v1/resource/generic/' + templateSrv.replace(metricsQuery[1]);
        } catch (err) {
          return $q.reject(err);
        }
        return this._gnocchi_request(req).then(function(resource) {
          return _.map(Object.keys(resource["metrics"]), function(m) {
            return { text: m };
          });
        });
      }

      return $q.when([]);
    };

    GnocchiDatasource.prototype.testDatasource = function() {
      return this._gnocchi_request({}).then(function () {
        return { status: "success", message: "Data source is working", title: "Success" };
      }, function(reason) {
        if (reason.status === 401) {
          return { status: "error", message: "Data source authentification fail", title: "Error" };
        } else if (reason.message) {
          return { status: "error", message: reason.message, title: "Error" };
        } else {
          return { status: "error", message: reason, title: "Error" };
        }
      });
    };

    ////////////////
    /// Query
    ////////////////

    GnocchiDatasource.prototype.validateSearchTarget = function(target) {
      var resource_search_req = {
        url: 'v1/search/resource/' + (target.resource_type || 'generic'),
        method: 'POST',
        data: target.resource_search,
      };
      return this._gnocchi_request(resource_search_req);
    };

    //////////////////////
    /// Utils
    //////////////////////

    GnocchiDatasource.prototype.validateTarget = function(target, syntax_only) {
      var mandatory = [];
      switch(target.queryMode) {
        case "metric":
          if (target.metric_id === "") {
            mandatory.push("Metric ID");
          }
          break;
        case "resource":
          if (target.resource_id === "") {
            mandatory.push("Resource ID");
          }
          if (target.metric_name === "") {
            mandatory.push("Metric name");
          }
          break;
        case "resource_aggregation":
        case "resource_search":
          if (target.resource_search === "") {
            mandatory.push("Query");
          }
          if (target.metric_name === "") {
            mandatory.push("Metric name");
          }
          break;
        default:
          break;
      }
      if (mandatory.length > 0) {
        return "Missing or invalid fields: " + mandatory.join(", ");
      } else if (syntax_only) {
        return;
      }

      switch(target.queryMode) {
        case "resource_aggregation":
        case "resource_search":
          this.validateSearchTarget(target).then(undefined, function(result) {
            return result.message;
          });
          break;
      }
      return;
    };

    function sanitize_url(url) {
      if (url[url.length - 1] !== '/') {
        return url + '/';
      } else {
        return url;
      }
    }

    //////////////////////
    /// KEYSTONE STUFFS
    //////////////////////

    GnocchiDatasource.prototype._gnocchi_request = function(additional_options) {
      var deferred = $q.defer();
      var _this = this;
      this._gnocchi_auth_request(deferred, function() {
        var options = {
          url: "",
          method: 'GET',
          headers: _this.default_headers,
        };
        angular.merge(options, additional_options);
        if (_this.url){
          options.url = _this.url + options.url;
        }
        return backendSrv.datasourceRequest(options).then(function(response) {
          deferred.resolve(response.data);
        });
      }, true);
      return deferred.promise;
    };

    GnocchiDatasource.prototype._gnocchi_auth_request = function(deferred, callback, retry) {
      var _this = this;
      if (this.keystone_endpoint !== null && this.url === null){
        this._keystone_auth_request(deferred, callback);
      } else {
        callback().then(undefined, function(reason) {
          if (reason.status === 0){
            reason.message = "Gnocchi error: Connection failed";
            deferred.reject(reason);
          } else if (reason.status === 401) {
            if (_this.keystone_endpoint !== null && retry){
              _this._keystone_auth_request(deferred, callback);
            } else {
              deferred.reject({'message': "Gnocchi authentication failure"});
            }
          } else if (reason.status === 404) {
            reason.message = "Metric not found: " + reason.data.replace(/<[^>]+>/gm, '').replace(/404 Not Found/gm, ""); // Strip html tag
            deferred.reject(reason);
          } else if (reason.status === 400) {
            reason.message = "Malformed query: " + reason.data.replace(/<[^>]+>/gm, '').replace(/400 Bad Request/gm, ""); // Strip html tag
            deferred.reject(reason);
          } else if (reason.status >= 300) {
            reason.message = 'Gnocchi error: ' + reason.data.replace(/<[^>]+>/gm, '');  // Strip html tag
            deferred.reject(reason);
          }
        });
      }
    };

    GnocchiDatasource.prototype._keystone_auth_request = function(deferred, callback) {
      var options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        url: this.keystone_endpoint + 'v3/auth/tokens',
        data: {
          "auth": {
            "identity": {
              "methods": ["password"],
              "password": {
                "user": {
                  "name": this.username,
                  "password": this.password,
                  "domain": { "id": "default"  }
                }
              }
            },
            "scope": {
              "project": {
                "domain": { "id": "default" },
                "name": this.project,
              }
            }
          }
        }
      };
      var _this = this;
      backendSrv.datasourceRequest(options).then(function(result) {
        _this.default_headers['X-Auth-Token'] = result.headers('X-Subject-Token');
        _.each(result.data['token']['catalog'], function(service) {
          if (service['type'] === 'metric') {
            _.each(service['endpoints'], function(endpoint) {
              if (endpoint['interface'] === 'public') {
                _this.url = sanitize_url(endpoint['url']);
              }
            });
          }
        });
        if (_this.url) {
          _this._gnocchi_auth_request(deferred, callback, false);
        } else {
          deferred.reject({'message': "'metric' endpoint not found in Keystone catalog"});
        }
      }, function(reason) {
        var message;
        if (reason.status === 0){
          message = "Connection failed";
        } else {
          message = '(' + reason.status + ' ' + reason.statusText + ') ';
          if (reason.data && reason.data.error) {
            message += ' ' + reason.data.error.message;
          }
        }
        deferred.reject({'message': 'Keystone failure: ' + message});
      });
    };

    return GnocchiDatasource;
  });

});
