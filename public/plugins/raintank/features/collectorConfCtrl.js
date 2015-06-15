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
          if (collector.org_id !== contextSrv.user.orgId) {
            $location.path('/collectors');
          } else {
            $scope.collector = collector;
          }
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

    $scope.init();

  });
});
