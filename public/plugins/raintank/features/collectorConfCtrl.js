define([
  'angular',
  'lodash'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('CollectorConfCtrl', function($scope, $q, $location, $routeParams, $http, backendSrv, contextSrv) {

    var defaults = {
      name: '',
    };

    $scope.init = function() {
      $scope.collectors = [];
      $scope.user = contextSrv.user;
      if ("id" in $routeParams) {
        $scope.getCollectors().then(function() {
          $scope.getCollector($routeParams.id);
        });
      } else {
        $scope.reset();
      }
    };

    $scope.getCollectors = function() {
      var promise = backendSrv.get('/api/collectors');
      promise.then(function(collectors) {
        $scope.collectors = collectors;
      });
      return promise;
    };

    $scope.reset = function() {
      $scope.collector = angular.copy(defaults);
    };

    $scope.cancel = function() {
      $scope.reset();
      $location.back();
    };

    $scope.getCollector = function(id) {
      _.forEach($scope.collectors, function(collector) {
        if (collector.id === parseInt(id)) {
          $scope.collector = collector;
          $scope.collectorUpdates = {
            "name": collector.name,
            "public": collector.public
          };
        }
      });
    };

    $scope.editableCollectors = function() {
      var list = [];
      _.forEach($scope.collectors, function(collector) {
        if (collector.org_id !== contextSrv.user.orgId) {
          return;
        }
        list.push(collector);
      });
      return list;
    };

    $scope.setCollector = function(id) {
      $location.path('/collectors/summary/'+id);
    };

    $scope.remove = function(collector) {
      backendSrv.delete('/api/collectors/' + collector.id).then(function() {
        $scope.getCollectors();
      });
    };

    $scope.save = function() {
      backendSrv.post('/api/collectors', $scope.collector);
    };

    $scope.update = function() {
      $scope.collector.name = $scope.collectorUpdates.name;
      $scope.collector.public = $scope.collectorUpdates.public;
      $scope.save();
    };

    $scope.add = function() {
      if (!$scope.collectorForm.$valid) {
        console.log("form invalid");
        return;
      }

      backendSrv.put('/api/collectors', $scope.collector)
        .then(function(resp) {
          $location.path('/collectors/edit/'+resp.id);
        });
    };

    $scope.gotoDashboard = function(collector) {
      $location.path("/dashboard/file/statusboard.json").search({"var-collector": collector.slug, "var-endpoint": "All"});
    };

    $scope.getEventsDashboardLink = function() {
      var path = "/dashboard-solo/file/rt-events.json";
      var qstring = "?panelId=1&fullscreen&from=now-30d&to=now&var-collector="+$scope.collector.slug;
      return path + qstring;
    };

    $scope.setEnabled = function(newState) {
      $scope.collector.enabled = newState;
      $scope.save();
    };

    $scope.init();

  });
});
