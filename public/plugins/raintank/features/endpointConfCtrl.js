define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('EndpointConfCtrl', function($scope, $q, $location, $timeout, $anchorScroll, $routeParams, $http, backendSrv, alertSrv) {
    $scope.pageReady = false;
    var defaults = {
      name: '',
    };
    var monitorLastState = {};

    var freqOpt = [10, 30, 60, 120];
    $scope.frequencyOpts = [];
    _.forEach(freqOpt, function(f) {
      $scope.frequencyOpts.push({value: f, label: "Every "+f+"s"});
    });

    $scope.init = function() {
      var promises = [];
      $scope.newEndpointName = "";
      $scope.endpoints = [];
      $scope.monitors = {};
      $scope.monitor_types = {};
      $scope.monitor_types_by_name = {};
      $scope.allCollectors = [];
      $scope.collectorsOption = {selection: "all"};
      $scope.collectorsByTag = {};
      $scope.global_collectors = {collector_ids: [], collector_tags: []};

      if ("id" in $routeParams) {
        promises.push($scope.getEndpoints().then(function() {
          $scope.getEndpoint($routeParams.id);
        }));
      }

      $scope.checks = {};
      promises.push($scope.getCollectors());
      promises.push($scope.getMonitorTypes());
      $q.all(promises).then(function() {
        $scope.pageReady = true;
        $scope.reset();
        $timeout(function() {
          $anchorScroll();
        }, 0, false);
      });

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

      if ($location.hash()) {
        switch($location.hash()) {
        case "ping":
          $scope.showPing = true;
          break;
        case "dns":
          $scope.showDNS = true;
          break;
        case "http":
          $scope.showHTTP = true;
          break;
        case "https":
          $scope.showHTTPS = true;
          break;
        }
      }
    };

    $scope.getCollectors = function() {
      return backendSrv.get('/api/collectors').then(function(collectors) {
        $scope.collectors = collectors;
        _.forEach(collectors, function(c) {
          $scope.allCollectors.push(c.id);
          _.forEach(c.tags, function(t) {
            if (!(t in $scope.collectorsByTag)) {
              $scope.collectorsByTag[t] = [];
            }
            $scope.collectorsByTag[t].push(c);
          });
        });
        $scope.global_collectors = {collector_ids: $scope.allCollectors, collector_tags: []};
      });
    };

    $scope.collectorCount = function(monitor) {
      if (!monitor) {
        return 0;
      }
      var ids = {};
      var tags = monitor.collector_tags;
      _.forEach(monitor.collector_ids, function(id) {
        ids[id] = true;
      });
      _.forEach(monitor.collector_tags, function(t) {
        _.forEach($scope.collectorsByTag[t], function(c) {
          ids[c.id] = true;
        });
      });
      return Object.keys(ids).length;
    };

    $scope.getMonitorTypes = function() {
      return backendSrv.get('/api/monitor_types').then(function(types) {
        var typesMap = {};
        _.forEach(types, function(type) {
          typesMap[type.id] = type;
          $scope.monitor_types_by_name[type.name.toLowerCase()] = type;
          $scope.setDefaultMonitor(type);
        });
        $scope.monitor_types = typesMap;
      });
    };

    $scope.setDefaultMonitor = function(type) {
      var settings = [];
      _.forEach(type.settings, function(setting) {
        var val = setting.default_value;
        if ($scope.endpoint && (setting.variable == "host" || setting.variable == "name" || setting.variable == "hostname")) {
          val = $scope.endpoint.name || "";
        }
        settings.push({variable: setting.variable, value: val});
      });
      
      if (!(type.name.toLowerCase() in $scope.monitors)) {
        $scope.monitors[type.name.toLowerCase()] = {
          id: null,
          endpoint_id: null,
          monitor_type_id: type.id,
          collector_ids: $scope.global_collectors.collector_ids,
          collector_tags: $scope.global_collectors.collector_tags,
          settings: settings,
          enabled: false,
          frequency: 10,
          //test: true,
        };
      }
    };

    $scope.defaultSettingByVariable = function(monitorType, variable) {
      var s = null;
      var type = $scope.monitor_types_by_name[monitorType];
      _.forEach(type.settings, function(setting) {
        if (setting.variable == variable) {
          s = setting;
        }
      });
      return s;
    }

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
      if (s.value === null) {
        var type = $scope.monitor_types[monitor.monitor_type_id];
        _.forEach(type.settings, function(setting) {
          if (setting.variable == variable) {
            s.value = setting.default_value;
          }
        });
      }

      return s;
    }
    $scope.reset = function() {
      $scope.endpoint = angular.copy(defaults);
      $scope.discovered = false;
      $scope.discoveryInProgress = false;
      $scope.discoveryError = false;
      $scope.showConfig = false;
      $scope.monitors = {};
      _.forEach($scope.monitor_types, function(type){
        $scope.setDefaultMonitor(type);
      });
    };

    $scope.cancel = function() {
      $scope.reset();
      window.history.back();
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
          $scope.newEndpointName = endpoint.name;
          //get monitors for this endpoint.
          backendSrv.get('/api/monitors?endpoint_id='+id).then(function(monitors) {
            _.forEach(monitors, function(monitor) {
              var type = $scope.monitor_types[monitor.monitor_type_id].name.toLowerCase();
              if (type in $scope.monitors) {
                _.assign($scope.monitors[type], monitor);
              } else {
                $scope.monitors[type] = monitor;
              }
              monitorLastState[monitor.id] = _.cloneDeep(monitor);
            });
            $scope.pageReady = true;
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
      $scope.endpoint.name = $scope.newEndpointName;
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

    $scope.addMonitor = function(monitor) {
      monitor.endpoint_id = $scope.endpoint.id;
      backendSrv.put('/api/monitors', monitor, true).then(function(resp) {
        _.defaults(monitor, resp);
        monitorLastState[monitor.id] = _.cloneDeep(monitor);
        var action = "disabled";
        if (monitor.enabled) {
          action = "enabled"
        }
        var type = $scope.monitor_types[resp.monitor_type_id];
        var message = type.name.toLowerCase() + " " + action + " successfully";
        alertSrv.set(message, '', 'success', 3000);
      });
    }

    $scope.updateMonitor = function(monitor) {
      if (!monitor.id) {
        return $scope.addMonitor(monitor);
      }
      backendSrv.post('/api/monitors', monitor, true).then(function() {
        var type = $scope.monitor_types[monitor.monitor_type_id];
        if (monitorLastState[monitor.id].enabled != monitor.enabled) {
          var action = "disabled";
          if (monitor.enabled) {
            action = "enabled"
          }
          var message = type.name.toLowerCase() + " " + action + " successfully";
        } else {
          var message = type.name.toLowerCase() + " updated";
        }
        monitorLastState[monitor.id] = _.cloneDeep(monitor);
        alertSrv.set(message, '', 'success', 3000);
      });
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
    }

    $scope.skipDiscovery = function() {
      $scope.discoveryInProgress = false;
      $scope.showConfig = true;
    }

    $scope.discover = function(endpoint) {
      $scope.discoveryInProgress = true;
      $scope.discoveryError = false;
      backendSrv.get('/api/endpoints/discover', endpoint).then(function(resp) {
        if (!$scope.showConfig) {
          $scope.showConfig = true;
          $scope.discovered = true;
          $scope.parseSuggestions(resp);
        }
      }, function(err) {
        $scope.discoveryError = "Failed to discover endpoint.";
      }).finally(function() {
        $scope.discoveryInProgress = false;
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
        alertSrv.set("endpoint added", '', 'success', 3000);
        $location.path("endpoints/summary/"+resp.id);
      });
    }

    $scope.gotoDashboard = function(endpoint) {
      $location.path("/dashboard/db/statusboard").search({"var-collector": "All", "var-endpoint": $scope.endpoint.slug});
    }

    $scope.init();

  });
});
