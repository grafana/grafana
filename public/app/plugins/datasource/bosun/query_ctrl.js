define([
  'angular',
  'lodash',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('BosunQueryCtrl', function($scope) {

    $scope.init = function() {
      var target = $scope.target;
      target.expr = target.expr || '';
    };
    $scope.init();
  });
});