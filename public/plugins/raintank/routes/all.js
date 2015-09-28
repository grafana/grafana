define([
  'angular',
],
function (angular) {
  "use strict";

  var module = angular.module('grafana.routes');

  module.config(function($routeProvider) {
    $routeProvider
      .when('/collectors', {
        templateUrl: 'plugins/raintank/features/partials/collectors.html',
        controller : 'CollectorCtrl',
      })
      .when('/collectors/summary/:id', {
        templateUrl: 'plugins/raintank/features/partials/collectors_summary.html',
        controller : 'CollectorConfCtrl',
      })
      .when('/collectors/init/:id', {
        templateUrl: 'plugins/raintank/features/partials/collectors_new.html',
        controller : 'CollectorConfCtrl',
      })
      .when('/collectors/new', {
        templateUrl: 'plugins/raintank/features/partials/collectors_new.html',
        controller : 'CollectorConfCtrl',
      })
      .when('/endpoints', {
        templateUrl: 'plugins/raintank/features/partials/endpoints.html',
        controller : 'EndpointsCtrl',
      })
      .when('/endpoints/new', {
        templateUrl: 'plugins/raintank/features/partials/endpoint_new.html',
        controller : 'EndpointConfCtrl',
      })
      .when('/endpoints/summary/:id', {
        templateUrl: 'plugins/raintank/features/partials/endpoints_summary.html',
        controller : 'EndpointSummaryCtrl',
      })
      .when('/endpoints/edit/:id', {
        templateUrl: 'plugins/raintank/features/partials/endpoints_edit.html',
        controller : 'EndpointConfCtrl',
      })
      .when('/endpoints/new_endpoint', {
        templateUrl: 'plugins/raintank/features/partials/endpoint_new.html',
        controller : 'EndpointConfCtrl',
      });
  });
});
