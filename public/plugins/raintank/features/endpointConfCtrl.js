define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('EndpointConfCtrl', function($scope, $q, $location, $routeParams, $http, backendSrv) {

    var defaults = {
      name: '',
    };

    $scope.init = function() {
      $scope.discovered = false;
      $scope.endpoints = [];
      $scope.monitors = {};
      $scope.monitor_types_by_name = {};
      $scope.allCollectors = [];
      $scope.collectorsOption = {selection: "all"};
      $scope.$watch("collectorsOption.selection", function(newVal) {
        if (newVal === "all") {
          $scope.global_collectors = {collector_ids: $scope.allCollectors, collector_tags: []};
        }
      });
      $scope.global_collectors = {collector_ids: [], collector_tags: []};
      $scope.$watch("global_collectors.collector_ids", function(newVal) {
        _.forEach($scope.monitors, function(monitor) {
          monitor.collector_ids = newVal;
        });
      });
      $scope.$watch("global_collectors.collector_tags", function(newVal) {
        _.forEach($scope.monitors, function(monitor) {
          monitor.collector_tags = newVal;
        });
      });
      if ("id" in $routeParams) {
        $scope.getEndpoints().then(function() {
          $scope.getEndpoint($routeParams.id);
        });
      } else {
        $scope.reset();
      }
      $scope.checks = {};
      $scope.getCollectors();
      $scope.getMonitorTypes();
      $scope.$watch('endpoint.name', function(newVal, oldVal) {
        $scope.discovered = false;
        for (var type in $scope.monitors) {
          var monitor = $scope.monitors[type];
          _.forEach(monitor.settings, function(setting) {
            if ((setting.variable == "host" || setting.variable == "name" || setting.variable == "hostname") && ((setting.value == "") || (setting.value == oldVal))) {
              setting.value = newVal;
            }
          });
        }
      });
    };

    $scope.getCollectors = function() {
      backendSrv.get('/api/collectors').then(function(collectors) {
        $scope.collectors = collectors;
        _.forEach(collectors, function(c) {
          $scope.allCollectors.push(c.id);
        });
        $scope.global_collectors = {collector_ids: $scope.allCollectors, collector_tags: []};
      });
    };

    $scope.getMonitorTypes = function() {
      backendSrv.get('/api/monitor_types').then(function(types) {
        var typesMap = {};
        _.forEach(types, function(type) {
          typesMap[type.id] = type;
          var settings = [];
          _.forEach(type.settings, function(setting) {
            var val = setting.default_value;
            if (setting.variable == "host" || setting.variable == "name" || setting.variable == "hostname") {
              val = $scope.endpoint.name || "";
            }
            settings.push({variable: setting.variable, value: val});
          });
          $scope.monitor_types_by_name[type.name.toLowerCase()] = type;
          if (!(type.name.toLowerCase() in $scope.monitors)) {
            $scope.monitors[type.name.toLowerCase()] = {
              endpoint_id: null,
              monitor_type_id: type.id,
              collector_ids: $scope.global_collectors.collector_ids,
              collector_tags: $scope.global_collectors.collector_tags,
              settings: settings,
              enabled: false,
              frequency: 10,
            };
          }
        });
        $scope.monitor_types = typesMap;
      });
    };

    $scope.currentSettingByVariable = function(monitor, variable) {
      var s = {
        "variable": variable,
        "value": null
      };
      var found = false
      _.forEach(monitor.settings, function(setting) {
        if (found) {
          return;
        }
        if (setting.variable == variable) {
          s = setting;
          found = true;
        }
      });
      if (! found) {
        monitor.settings.push(s);
      }
      return s;
    }
    $scope.reset = function() {
      $scope.endpoint = angular.copy(defaults);
    };

    $scope.cancel = function() {
      $scope.reset();
      collector.back();
    };
    $scope.getEndpoints = function() {
      var promise = backendSrv.get('/api/endpoints')
      promise.then(function(endpoints) {
        $scope.endpoints = endpoints;
      });
      return promise;
    }
    $scope.getEndpoint = function(id) {
      _.forEach($scope.endpoints, function(endpoint) {
        if (endpoint.id == id) {
          $scope.endpoint = endpoint;
          //get monitors for this endpoint.
          backendSrv.get('/api/monitors?endpoint_id='+id).then(function(monitors) {
            _.forEach(monitors, function(monitor) {
              var type = $scope.monitor_types[monitor.monitor_type_id];
              $scope.monitors[type.name.toLowerCase()] = monitor;
            });
          });
        }
      });
    };

    $scope.setEndpoint = function(id) {
      $location.path('/endpoints/edit/'+id);
    }

    $scope.remove = function(endpoint) {
      backendSrv.delete('/api/endpoints/' + endpoint.id).then(function() {
        $scope.getEndpoints();
      });
    };

    $scope.removeMonitor = function(mon) {
      var type = $scope.monitor_types[mon.monitor_type_id];
      backendSrv.delete('/api/monitors/' + mon.id).then(function() {
        var settings = [];
        _.forEach($scope.monitor_types[type.id].settings, function(setting) {
          var val = setting.default_value;
          if (setting.variable == "host" || setting.variable == "name" || setting.variable == "hostname") {
            val = $scope.endpoint.name;
          }
          settings.push({variable: setting.variable, value: val});
        });
        var frequency = 10;
        if ($scope.monitor_types[type.id].name.indexOf("HTTP") == 0) {
          frequency = 60;
        }
        $scope.monitors[type.name.toLowerCase()] = {
          endpoint_id: null,
          monitor_type_id: type.id,
          collector_ids: $scope.global_collectors.collector_ids,
          collector_tags: $scope.global_collectors.collector_tags,
          settings: settings,
          enabled: false,
          frequency: frequency,
        };
      });
    };

    $scope.updateEndpoint = function() {
      backendSrv.post('/api/endpoints', $scope.endpoint);
    };

    $scope.save = function() {
      var promises = [];
      _.forEach($scope.monitors, function(monitor) {
        monitor.endpoint_id = $scope.endpoint.id;
        if (monitor.id) {
          promises.push(backendSrv.post('/api/monitors', monitor));
        } else if (monitor.enabled) {
          promises.push(backendSrv.put('/api/monitors', monitor));
        }
      });
      promises.push(backendSrv.post('/api/endpoints', $scope.endpoint));
      $q.all(promises).then(function() {
        $location.path("/endpoints");
      });
    }

    $scope.updateMonitor = function(monitor) {
      backendSrv.post('/api/monitors', monitor);
    }

    $scope.parseSuggestions = function(payload) {
      var defaults = {
        endpoint_id: 0,
        monitor_type_id: 1,
        collector_ids: $scope.global_collectors.collector_ids,
        collector_tags: $scope.global_collectors.collector_tags,
        settings: [],
        enabled: true,
        frequency: 10,
      };
      _.forEach(payload, function(suggestion) {
        _.defaults(suggestion, defaults);
        var type = $scope.monitor_types[suggestion.monitor_type_id];
        if (type.name.indexOf("HTTP") == 0) {
          suggestion.frequency = 60;
        }
        $scope.monitors[type.name.toLowerCase()] = suggestion;
      });
      console.log($scope.monitors);
    }

    $scope.discover = function(endpoint) {
      backendSrv.get('/api/endpoints/discover', endpoint).then(function(resp) {
        $scope.discovered = true;
        $scope.parseSuggestions(resp);
      });
    }

    $scope.addEndpoint = function() {
      if ($scope.endpoint.id) {
        return updateEndpoint();
      }

      var payload = $scope.endpoint;
      payload.monitors = [];
      _.forEach($scope.monitors, function(monitor) {
        if (monitor.enabled) {
          payload.monitors.push(monitor);
        }
      });
      backendSrv.put('/api/endpoints', payload).then(function(resp) {
        $scope.endpoint = resp;
        $scope.dismiss();
      });
    }

    $scope.gotoDashboard = function(endpoint) {
      $location.path("/dashboard/db/statusboard").search({"var-collector": "All", "var-endpoint": $scope.endpoint.slug});
    }

    $scope.init();

  });
});
