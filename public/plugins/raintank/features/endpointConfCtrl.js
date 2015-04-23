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
      $scope.endpoints = [];
      if ("id" in $routeParams) {
        $scope.getEndpoints().then(function() {
          $scope.getEndpoint($routeParams.id);
          $scope.monitors = {};
        });
      } else {
        $scope.reset();
      }
      $scope.checks = {};
      $scope.getCollectors();
      $scope.getMonitorTypes();
      $scope.$watch('endpoint.name', function(newVal, oldVal) {
        for (var id in $scope.monitors) {
          var monitor = $scope.monitors[id];
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
          if (!(type.id in $scope.monitors)) {
            $scope.monitors[type.id] = {
              endpoint_id: null,
              monitor_type_id: type.id,
              collectorGroup: 'all',
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
      $scope.monitors = {};
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
              $scope.monitors[monitor.monitor_type_id] = monitor;
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
      var type_id = mon.monitor_type_id;
      backendSrv.delete('/api/monitors/' + mon.id).then(function() {
        var settings = [];
        _.forEach($scope.monitor_types[type_id].settings, function(setting) {
          var val = setting.default_value;
          if (setting.variable == "host" || setting.variable == "name" || setting.variable == "hostname") {
            val = $scope.endpoint.name;
          }
          settings.push({variable: setting.variable, value: val});
        });
        var frequency = 10;
        if ($scope.monitor_types[type_id].name.indexOf("HTTP") == 0) {
          frequency = 60;
        }
        $scope.monitors[type_id] = {
          endpoint_id: null,
          monitor_type_id: type_id,
          collectorGroup: 'all',
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

      $q.all(promises).then(function() {
        $location.path("/endpoints");
      });
    }

    $scope.updateMonitor = function(monitor) {
      backendSrv.post('/api/monitors', monitor);
    }

    $scope.parseSuggestions = function(payload) {
      var collectors = [];
      _.forEach($scope.collectors, function(loc) {
        collectors.push(loc.id);
      });
      var defaults = {
        endpoint_id: payload.endpoint.id,
        monitor_type_id: 1,
        collector_ids: collectors,
        settings: [],
        enabled: true,
        frequency: 10,
      };
      _.forEach(payload.suggested_monitors, function(suggestion) {
        _.defaults(suggestion, defaults);
        $scope.monitors[suggestion.monitor_type_id] = suggestion;
      });
      $scope.endpoint.id = payload.endpoint.id;
    }

    $scope.add = function() {
      if (!$scope.endpointForm.$valid) {
        console.log("form invalid");
        return;
      }

      backendSrv.put('/api/endpoints', $scope.endpoint)
        .then(function(resp) {
          $scope.parseSuggestions(resp);
        });
    };

    $scope.slug = function(name) {
      var label = name.toLowerCase();
      var re = new RegExp("[^\\w-]+");
      var re2 = new RegExp("\\s");
      var slug = label.replace(re, "_").replace(re2, "-");
      return slug;
    }

    $scope.gotoDashboard = function(endpoint) {
      $location.path("/dashboard/db/statusboard").search({"var-collector": "All", "var-endpoint": $scope.slug($scope.endpoint.name)});
    }

    $scope.init();

  });
});
