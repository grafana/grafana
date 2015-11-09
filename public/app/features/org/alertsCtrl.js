define([
  'angular',
  'lodash',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AlertsCtrl', function($scope, $http) {
    var alertUrl = "http://0.0.0.0:5001/alert/definition";
    $http({
      method: "get",
      url: alertUrl,
    }).then(function onSuccess(response) {
      $scope.alertDefList = response.data;
    }, function onFailed(response) {
      $scope.data = response.data || "Request failed";
      $scope.status = response.status;
    });

    $scope.remove = function() {
    };
  });
});
