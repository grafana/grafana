define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('EndpointConfCtrl', function(
      $scope, $q, $modal, $location, $timeout, $anchorScroll,
      $routeParams, $http, $window, backendSrv, alertSrv) {

    $scope.pageReady = false;

    var monitorLastState = {};
    var freqOpt = [10, 30, 60, 120];

    $scope.frequencyOpts = [];

    _.forEach(freqOpt, function(f) {
      $scope.frequencyOpts.push({value: f, label: "Every "+f+"s"});
    });

    $scope.init = function() {
      var promises = [];
      $scope.editor = {index: 0};
      $scope.newEndpointName = "";
      $scope.endpoints = [];
      $scope.monitors = {};
      $scope.monitor_types = {};
      $scope.monitor_types_by_name = {};
      $scope.allCollectors = [];
      $scope.collectorsOption = {selection: "all"};
      $scope.collectorsByTag = {};
      $scope.global_collectors = {collector_ids: [], collector_tags: []};
      $scope.ignoreChanges = false;
      $scope.originalState = {};

      if ("id" in $routeParams) {
        promises.push($scope.getEndpoints().then(function() {
          $scope.getEndpoint($routeParams.id);
        }));
      } else {
        $scope.endpoint = {name: ""};
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

      $window.onbeforeunload = function() {
        if ($scope.ignoreChanges) { return; }
        if ($scope.changesPending()) {
          return "There are unsaved changes to this dashboard";
        }
      };

      $scope.$on('$locationChangeStart', function(event, next) {
        if ((!$scope.ignoreChanges) && ($scope.changesPending())) {
          event.preventDefault();
          var baseLen = $location.absUrl().length - $location.url().length;
          var nextUrl = next.substring(baseLen);
          var modalScope = $scope.$new();
          modalScope.ignore = function() {
            $scope.ignoreChanges = true;
            $location.path(nextUrl);
            return;
          };

          modalScope.save = function() {
            $scope.save(nextUrl);
          };

          var confirmModal = $modal({
            template: './app/partials/unsaved-changes.html',
            modalClass: 'modal-no-header confirm-modal',
            persist: false,
            show: false,
            scope: modalScope,
            keyboard: false
          });

          $q.when(confirmModal).then(function(modalEl) {
            modalEl.modal('show');
          });
        }
      });
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
      if (!(type.name.toLowerCase() in $scope.monitors)) {
        var settings = [];
        _.forEach(type.settings, function(setting) {
          var val = setting.default_value;
          if ($scope.endpoint && (setting.variable === "host" || setting.variable === "name" || setting.variable === "hostname")) {
            val = $scope.endpoint.name || "";
          }
          settings.push({variable: setting.variable, value: val});
        });
        $scope.monitors[type.name.toLowerCase()] = {
          id: null,
          endpoint_id: null,
          monitor_type_id: type.id,
          collector_ids: $scope.global_collectors.collector_ids,
          collector_tags: $scope.global_collectors.collector_tags,
          settings: settings,
          enabled: false,
          frequency: 10,
          health_settings: {
            steps: 3,
            num_collectors: 3,
            notifications: {
              enabled: false,
              addresses: ""
            }
          }
        };
      }
    };

    $scope.defaultSettingByVariable = function(monitorType, variable) {
      var s = null;
      var type = $scope.monitor_types_by_name[monitorType];
      _.forEach(type.settings, function(setting) {
        if (setting.variable === variable) {
          s = setting;
        }
      });
      return s;
    };

    $scope.currentSettingByVariable = function(monitor, variable) {
      var s = {
        "variable": variable,
        "value": null
      };
      var found = false;
      _.forEach(monitor.settings, function(setting) {
        if (found) {
          return;
        }
        if (setting.variable === variable) {
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
          if (setting.variable === variable) {
            s.value = setting.default_value;
          }
        });
      }

      return s;
    };

    $scope.reset = function() {
      $scope.discovered = false;
      $scope.discoveryInProgress = false;
      $scope.discoveryError = false;
      $scope.showConfig = false;
      // $scope.endpoint.name = {"name": ""};
      $scope.monitors = {};
      _.forEach($scope.monitor_types, function(type) {
        $scope.setDefaultMonitor(type);
      });
    };

    $scope.cancel = function() {
      $scope.reset();
      $scope.ignoreChanges = true;
      window.history.back();
    };

    $scope.getEndpoints = function() {
      var promise = backendSrv.get('/api/endpoints');
      promise.then(function(endpoints) {
        $scope.endpoints = endpoints;
      });
      return promise;
    };

    $scope.getEndpoint = function(idString) {
      var id = parseInt(idString);
      _.forEach($scope.endpoints, function(endpoint) {
        if (endpoint.id === id) {
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
    };

    $scope.remove = function(endpoint) {
      backendSrv.delete('/api/endpoints/' + endpoint.id).then(function() {
        $scope.getEndpoints();
      });
    };

    $scope.removeMonitor = function(mon) {
      var type = $scope.monitor_types[mon.monitor_type_id];
      backendSrv.delete('/api/monitors/' + mon.id).then(function() {
        $scope.setDefaultMonitor(type.name.toLowerCase());
        delete monitorLastState[mon.id];
      });
    };

    $scope.updateEndpoint = function() {
      $scope.endpoint.name = $scope.newEndpointName;
      backendSrv.post('/api/endpoints', $scope.endpoint);
    };

    $scope.save = function(location) {
      var promises = [];
      _.forEach($scope.monitors, function(monitor) {
        monitor.endpoint_id = $scope.endpoint.id;
        if (monitor.id) {
          if (!angular.equals(monitor, monitorLastState[monitor.id])) {
            promises.push($scope.updateMonitor(monitor));
          }
        } else if (monitor.enabled) {
          promises.push($scope.addMonitor(monitor));
        }
      });

      promises.push(backendSrv.post('/api/endpoints', $scope.endpoint));
      $q.all(promises).then(function() {
        if (location) {
          $location.path(location);
        } else {
          $location.path("/endpoints");
        }
      });
    };

    $scope.addMonitor = function(monitor) {
      monitor.endpoint_id = $scope.endpoint.id;
      return backendSrv.put('/api/monitors', monitor, true).then(function(resp) {
        _.defaults(monitor, resp);
        monitorLastState[monitor.id] = _.cloneDeep(monitor);
        var action = "disabled";
        if (monitor.enabled) {
          action = "enabled";
        }
        var type = $scope.monitor_types[resp.monitor_type_id];
        var message = type.name.toLowerCase() + " " + action + " successfully";
        alertSrv.set(message, '', 'success', 3000);
      });
    };

    $scope.updateMonitor = function(monitor) {
      if (!monitor.id) {
        return $scope.addMonitor(monitor);
      }

      return backendSrv.post('/api/monitors', monitor, true).then(function() {
        var type = $scope.monitor_types[monitor.monitor_type_id];
        var message = type.name.toLowerCase() + " updated";
        if (monitorLastState[monitor.id].enabled !== monitor.enabled) {
          var action = "disabled";
          if (monitor.enabled) {
            action = "enabled";
          }
          message = type.name.toLowerCase() + " " + action + " successfully";
        }

        monitorLastState[monitor.id] = _.cloneDeep(monitor);
        alertSrv.set(message, '', 'success', 3000);
      });
    };

    $scope.parseSuggestions = function(payload) {
      var defaults = {
        endpoint_id: 0,
        monitor_type_id: 1,
        collector_ids: $scope.global_collectors.collector_ids,
        collector_tags: $scope.global_collectors.collector_tags,
        settings: [],
        enabled: true,
        frequency: 10,
        health_settings: {
          steps: 3,
          num_collectors: 3,
          notifications: {
            enabled: false,
            addresses: ""
          }
        }
      };
      _.forEach(payload, function(suggestion) {
        _.defaults(suggestion, defaults);
        var type = $scope.monitor_types[suggestion.monitor_type_id];
        if (type.name.indexOf("HTTP") === 0) {
          suggestion.frequency = 60;
        }
        $scope.monitors[type.name.toLowerCase()] = suggestion;
      });
    };

    $scope.skipDiscovery = function() {
      $scope.discoveryInProgress = false;
      $scope.showConfig = true;
      $scope.discoveryError = false;
    };

    $scope.discover = function(endpoint) {
      $scope.discoveryInProgress = true;
      $scope.discoveryError = false;
      backendSrv.get('/api/endpoints/discover', endpoint).then(function(resp) {
        if (!$scope.showConfig) {
          if (endpoint.name.indexOf("://") > -1) {
            //endpoint name is in the form scheme://domain
            var parser = document.createElement('a');
            parser.href = endpoint.name;
            endpoint.name = parser.hostname;
          }
          $scope.showConfig = true;
          $scope.discovered = true;
          $scope.parseSuggestions(resp);
        }
      }, function() {
        $scope.discoveryError = "Failed to discover endpoint.";
      }).finally(function() {
        $scope.discoveryInProgress = false;
      });
    };

    $scope.addEndpoint = function() {
      if ($scope.endpoint.id) {
        return $scope.updateEndpoint();
      }

      var payload = $scope.endpoint;
      payload.monitors = [];
      _.forEach($scope.monitors, function(monitor) {
        monitor.endpoint_id = -1;
        payload.monitors.push(monitor);
      });
      backendSrv.put('/api/endpoints', payload).then(function(resp) {
        $scope.endpoint = resp;
        $scope.ignoreChanges = true;
        alertSrv.set("endpoint added", '', 'success', 3000);
        $location.path("endpoints/summary/"+resp.id);
      });
    };

    $scope.changesPending = function() {
      var changes = false;
      _.forEach($scope.monitors, function(monitor) {
        if (monitor.id === null) {
          return;
        }
        if (!angular.equals(monitor, monitorLastState[monitor.id])) {
          changes = true;
        }
      });
      return changes;
    };

    $scope.gotoDashboard = function(endpoint, type) {
      if (!type) {
        type = 'summary';
      }
      var search = {
        "var-collector": "All",
        "var-endpoint": $scope.endpoint.slug
      };
      switch(type) {
        case "summary":
          $location.path("/dashboard/file/rt-endpoint-summary.json").search(search);
          break;
        case "ping":
          $location.path("/dashboard/file/rt-endpoint-ping.json").search(search);
          break;
        case "dns":
          $location.path("/dashboard/file/rt-endpoint-dns.json").search(search);
          break;
        case "http":
          search['var-protocol'] = "http";
          $location.path("/dashboard/file/rt-endpoint-web.json").search(search);
          break;
        case "https":
          search['var-protocol'] = "https";
          $location.path("/dashboard/file/rt-endpoint-web.json").search(search);
          break;
        default:
          $location.path("/dashboard/file/rt-endpoint-summary.json").search(search);
          break;
      }
    };
    $scope.init();

  });
});
