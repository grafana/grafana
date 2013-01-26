/*jshint globalstrict:true */
/*global angular:true */
'use strict';

/* Application level module which depends on filters, controllers, and services */
angular.module('kibana-dash', [
  'kibana-dash.controllers', 
  'kibana-dash.filters', 
  'kibana-dash.services', 
  'kibana-dash.directives', 
  'elasticjs.service',
  'kibana-dash.panels'
  ]).config(['$routeProvider', function($routeProvider) {
    $routeProvider
      .when('/dashboard', {
        templateUrl: 'partials/dashboard.html' 
      })
      .otherwise({
        redirectTo: '/dashboard'
      });
  }]);
