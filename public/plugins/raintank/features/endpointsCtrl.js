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
      $scope.endpoint_filter = '';
      $scope.status_filter = '';
      $scope.sort_field = 'name';
      $scope.endpoints = [];
      $scope.getEndpoints();
      $scope.getCollectors();
      $scope.getMonitorTypes();
      $scope.endpointState = {
        "ok": 0,
        "warn": 0,
        "error": 0,
        "unknown": 0,
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

    $scope.setEndpointFilter = function(tag) {
      $scope.endpoint_filter = tag;
    };
    $scope.setStatusFilter = function(status) {
      if (status === $scope.status_filter) {
        status = "";
      }
      $scope.status_filter = status;
    };

    $scope.statusFilter = function(actual, expected) {
      if (expected === "") {
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
          backendSrv.get('/api/endpoints/'+endpoint.id+'/health').then(function(health) {
            endpoint.health = health;
            var okCount = 0;
            var warnCount = 0;
            var errorCount = 0;
            var unknownCount = 0;
            var monitors = {};
            _.forEach(health, function(checkState) {
              if (!(checkState.monitor_id in monitors)) {
                monitors[checkState.monitor_id] = {
                  okCount: 0,
                  warnCount: 0,
                  errorCount: 0,
                  unknownCount: 0,
                  totalCount: 0
                }
              }
              monitors[checkState.monitor_id].totalCount++;

              if (checkState.state == -1) {
                monitors[checkState.monitor_id].unknownCount++;
                return
              }
              if (checkState.state == 0) {
                monitors[checkState.monitor_id].okCount++;
                return
              }
              if (checkState.state == 1) {
                monitors[checkState.monitor_id].warnCount++;
                return
              }
              if (checkState.state == 2) {
                monitors[checkState.monitor_id].errorCount++;
                return
              }
            });
            var max = 0;
            for (var monId in monitors) {
              var mon = monitors[monId];
              if ((mon.okCount < mon.totalCount/2) || ((mon.totalCount - mon.okCount) >= 3)) {
                if (mon.errorCount > 0) {
                  mon.state = 2;
                  max = 2;
                } else if (mon.warnCount > 0) {
                  mon.state = 1;
                  if (max < 1) {
                    max = 1;
                  }
                } else {
                  mon.state = -1;
                  if (max < 1) {
                    max = -1;
                  }
                }
              }
            }
            endpoint.state = max;
            if (max == -1) {
              $scope.endpointState["unknown"]++;
            } else if (max == 0) {
              $scope.endpointState["ok"]++;
            } else if (max == 1) {
              $scope.endpointState["warn"]++;
            } else if (max == 2) {
              $scope.endpointState["error"]++;
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

    $scope.slug = function(name) {
      var label = name.toLowerCase();
      var re = new RegExp("[^\\w-]+", "g");
      var re2 = new RegExp("\\s", "g");
      var slug = label.replace(re, "_").replace(re2, "-");
      return slug;
    }

    $scope.gotoDashboard = function(endpoint) {
      $location.path("/dashboard/raintank/rt-endpoint-summary").search({"var-collector": "All", "var-endpoint": $scope.slug(endpoint.name)});
    }

    var newEndpointModalScope = null;
    $scope.openNewEndPointModal = function() {
      if (newEndpointModalScope) { return; }
      newEndpointModalScope = $rootScope.$new();
      var newEndpointModal = $modal({
        template: './plugins/raintank/features/partials/endpoint_modal_new.html',
        modalClass: 'rt-modal-override',
        persist: false,
        show: false,
        scope: newEndpointModalScope,
        keyboard: false
      });
      newEndpointModalScope.$on('$destroy', function() { newEndpointModalScope = null; $scope.getEndpoints();});
      $q.when(newEndpointModal).then(function(modalEl) { modalEl.modal('show'); });
    }

    $scope.init();

  });
});
