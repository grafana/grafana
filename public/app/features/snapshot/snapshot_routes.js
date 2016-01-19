define([
  'angular',
  'app/core/config',
  'lodash'
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.routes');

  module.config(function($routeProvider) {
    $routeProvider
      .when('/dashboard/snapshots', {
        templateUrl: 'app/features/snapshot/partials/snapshots.html',
        controller : 'SnapshotsCtrl'
      });
  });
});
