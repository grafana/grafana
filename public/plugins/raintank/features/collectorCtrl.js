define([
  'angular',
  'lodash'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('CollectorCtrl', function($scope, $http, $location, backendSrv) {
    $scope.pageReady = false;
    $scope.statuses = [
      {label: "Up", value: "up"},
      {label: "Down", value: "down"},
    ];

    $scope.init = function() {
      $scope.collector_filter = {value: ""};
      $scope.status_filter = {value: ""};
      $scope.sort_field = "name";
      $scope.collectors = [];
      $scope.getCollectors();
    };

    $scope.collectorTags = function() {
      var map = {};
      _.forEach($scope.collectors, function(collector) {
        _.forEach(collector.tags, function(tag) {
          map[tag] = true;
        });
      });
      return Object.keys(map);
    };

    $scope.setCollectorFilter = function(tag) {
      $scope.collector_filter.value = tag;
    };

    $scope.setStatusFilter = function(newStatus) {
      if (newStatus === $scope.status_filter.value) {
        newStatus = "";
      }
      $scope.status_filter.value = newStatus;
    };

    $scope.statusFilter = function(actual, expected) {
      if (expected === "") {
        return true;
      }
      var equal = ((actual ? "up" :"down") === expected);
      return equal;
    };

    $scope.getCollectors = function() {
      backendSrv.get('/api/collectors').then(function(collectors) {
        $scope.pageReady = true;
        $scope.collectors = collectors;
      });
    };

    $scope.remove = function(loc) {
      backendSrv.delete('/api/collectors/' + loc.id).then(function() {
        $scope.getCollectors();
      });
    };

    $scope.gotoDashboard = function(collector) {
      $location.path("/dashboard/file/statusboard.json").search({"var-collector": collector.slug, "var-endpoint": "All"});
    };

    $scope.init();
  });
});
