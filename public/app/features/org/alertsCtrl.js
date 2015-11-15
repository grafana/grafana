define([
  'angular',
  'lodash',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AlertsCtrl', function($scope, $http, backendSrv) {
    $scope.init = function() {
      $scope.getAlertsource();
    };

    $scope.getAlertsource = function() {
      backendSrv.get('/api/alertsource').then(function(result) {
        $scope.alertUrl = result.alert.alert_url;
      });
    };

    //var alertUrl = "http://0.0.0.0:5001/alert/definition";
    $http({
      method: "get",
      url: $scope.alertUrl,
    }).then(function onSuccess(response) {
      $scope.alertDefList = response.data;
    }, function onFailed(response) {
      $scope.data = response.data || "Request failed";
      $scope.status = response.status;
    });

    $scope.remove = function() {
    };

    $scope.init();

  });
});
