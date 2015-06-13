define([
  'angular',
  'lodash'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('EndpointSummaryCtrl', function($scope, $q, $http, backendSrv, $location, $routeParams) {
    $scope.pageReady = false;
    $scope.init = function() {
      $scope.endpoints = [];
      $scope.monitors = {};
      $scope.monitor_types = {};
      $scope.monitor_types_by_name = {};
      $scope.endpoint = null;
      $scope.refreshTime = new Date();
      $scope.getMonitorTypes();
      var promise = $scope.getEndpoints();
      promise.then(function() {
        $scope.getEndpoint($routeParams.id);
      });
    };

    $scope.getEndpoints = function() {
      var promise = backendSrv.get('/api/endpoints');
      promise.then(function(endpoints) {
        $scope.endpoints = endpoints;
      });
      return promise;
    };

    $scope.tagsUpdated = function() {
      backendSrv.post("/api/endpoints", $scope.endpoint);
    };

    $scope.getMonitorTypes = function() {
      backendSrv.get('/api/monitor_types').then(function(types) {
        _.forEach(types, function(type) {
          $scope.monitor_types[type.id] = type;
          $scope.monitor_types_by_name[type.name] = type;
        });
        console.log("monitor_types ready");
      });
    };

    $scope.getEndpoint = function(id) {
      _.forEach($scope.endpoints, function(endpoint) {
        if (endpoint.id === parseInt(id)) {
          $scope.endpoint = endpoint;
          //get monitors for this endpoint.
          backendSrv.get('/api/monitors?endpoint_id='+id).then(function(monitors) {
            _.forEach(monitors, function(monitor) {
              $scope.monitors[monitor.monitor_type_id] = monitor;
            });
            $scope.pageReady = true;
          });
        }
      });
    };

    $scope.getMonitorByTypeName = function(name) {
      if (name in $scope.monitor_types_by_name) {
        var type = $scope.monitor_types_by_name[name];
        return $scope.monitors[type.id];
      }
      return undefined;
    };

    $scope.monitorStateTxt = function(mon) {
      if (typeof(mon) !== "object") {
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

    $scope.stateChangeStr = function(mon) {
      if (typeof(mon) !== "object") {
        return "";
      }
      var duration = new Date().getTime() - new Date(mon.state_change).getTime();
      if (duration < 10000) {
        return "a few seconds ago";
      }
      if (duration < 60000) {
        var secs = Math.floor(duration/1000);
        return "for " + secs + " seconds";
      }
      if (duration < 3600000) {
        var mins = Math.floor(duration/1000/60);
        return "for " + mins + " minutes";
      }
      if (duration < 86400000) {
        var hours = Math.floor(duration/1000/60/60);
        return "for " + hours + " hours";
      }
      var days = Math.floor(duration/1000/60/60/24);
      return "for " + days + " days";
    };

    $scope.setEndpoint = function(id) {
      $location.path('/endpoints/summary/'+id);
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
          $location.path("/dashboard/file/statusboard.json").search(search);
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
          $location.path("/dashboard/file/statusboard.json").search(search);
          break;
      }
    };

    $scope.refresh = function() {
      $scope.pageReady = false;
      $scope.getEndpoint($scope.endpoint.id);
      $scope.refreshTime = new Date();
    };

    $scope.init();
  });
});
