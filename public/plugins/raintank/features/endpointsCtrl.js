define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('EndpointsCtrl', function($scope, $http, $location, $rootScope, $modal, $q, backendSrv) {

    var defaults = {
      name: '',
    };

    $scope.statuses = [
      {label: "Ok", value: 0},
      {label: "Warning", value: 1},
      {label: "Error", value: 2},
      {label: "Unknown", value: -1},
    ];

    $scope.init = function() {
      $scope.filter = {'tag': '', 'status': ''};
      $scope.sort_field = 'name';
      $scope.endpoints = [];
      $scope.getEndpoints();
      $scope.getCollectors();
      $scope.getMonitorTypes();
      $scope.endpointState = {
        "0": 0,
        "1": 0,
        "2": 0,
        "-1": 0,
      };
    };

    $scope.endpointTags = function() {
      var map = {};
      _.forEach($scope.endpoints, function(endpoint) {
        _.forEach(endpoint.tags, function(tag) {
          map[tag] = true;
        });
      });
      return Object.keys(map);
    }

    $scope.setTagFilter = function(tag) {
      $scope.filter.tag = tag;
    };
    $scope.setStatusFilter = function(status) {
      if (status === $scope.filter.status) {
        status = "";
      }
      $scope.filter.status = status;
    };

    $scope.statusFilter = function(actual, expected) {
      if (expected === "" || expected === null) {
        return true;
      }
      var equal = (actual === expected);
      return equal;
    }

    $scope.getCollectors = function() {
      var collectorMap = {};
      backendSrv.get('/api/collectors').then(function(collectors) {
        _.forEach(collectors, function(loc) {
          collectorMap[loc.id] = loc;
        });
        $scope.collectors = collectorMap;
      });
    };

    $scope.getMonitorTypes = function() {
      backendSrv.get('/api/monitor_types').then(function(types) {
        var typesMap = {};
        _.forEach(types, function(type) {
          typesMap[type.id] = type;
        });
        $scope.monitor_types = typesMap;
      });
    };

    $scope.getEndpoints = function() {
      backendSrv.get('/api/endpoints').then(function(endpoints) {
        $scope.endpoints = endpoints;
        _.forEach($scope.endpoints, function(endpoint) {
          backendSrv.get('/api/monitors', {"endpoint_id": endpoint.id}).then(function(monitors) {
            endpoint.states = [];
            var seenStates = {};
            endpoint.monitors = {};
            _.forEach(monitors, function(mon) {
              if (!mon.enabled) {
                return;
              }
              seenStates[mon.state] = true;
              endpoint.monitors[$scope.monitor_types[mon.monitor_type_id].name.toLowerCase()] = mon;
            });
            for (var s in seenStates) {
              $scope.endpointState[s]++;
              endpoint.states.push(parseInt(s));
            }
          });
        });
      });
    };

    $scope.remove = function(endpoint) {
      backendSrv.delete('/api/endpoints/' + endpoint.id).then(function() {
        $scope.getEndpoints();
      });
    };

    $scope.monitorStateTxt = function(endpoint, type) {
      var mon=endpoint.monitors[type];
      if (typeof(mon) != "object") {
        return "disabled";
      }
      if (!mon.enabled) {
        return "disabled";
      }
      if (mon.state < 0 || mon.state > 2) {
        return 'nodata';
      }
      var states = ["online", "warn", "critical"];
      return states[mon.state];
    };

    $scope.gotoDashboard = function(endpoint) {
      $location.path("/dashboard/file/rt-endpoint-summary.json").search({"var-collector": "All", "var-endpoint": endpoint.slug});
    }

    $scope.init();

  });
});
