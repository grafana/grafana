define([
  'angular',
  'lodash',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AlertsCtrl', function($scope, alertMgrSrv) {
    alertMgrSrv.load().then(function onSuccess(response) {
      $scope.alertDefList = response.data;
    }, function onFailed(response) {
      $scope.err = response.message || "Request failed";
      $scope.status = response.status;
    });

    $scope.remove = function() {
    };
  });
});
