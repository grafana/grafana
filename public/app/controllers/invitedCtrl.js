define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('InvitedCtrl', function($scope, contextSrv) {

    contextSrv.sidemenu = false;

    $scope.init = function() {
    };

    $scope.init();

  });
});
