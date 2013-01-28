/*jshint globalstrict:true */
/*global angular:true */
'use strict';

// Base modules
var modules = [
  'kibana.controllers', 
  'kibana.filters', 
  'kibana.services', 
  'kibana.directives', 
  'elasticjs.service',
  'kibana.panels',
  ]

/* Application level module which depends on filters, controllers, and services */
angular.module('kibana', modules).config(['$routeProvider', function($routeProvider) {
    $routeProvider
      .when('/dashboard', {
        templateUrl: 'partials/dashboard.html' 
      })
      .otherwise({
        redirectTo: '/dashboard'
      });
  }]);
