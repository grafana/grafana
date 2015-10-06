define([
  'angular',
],
function(angular) {
  'use strict';

  var module = angular.module('grafana.services');
  module.service('googleAnalyticsSrv', function($rootScope, $location) {

    var first = true;

    this.init = function() {
      $rootScope.$on('$viewContentLoaded', function() {
        // skip first
        if (first) {
          first = false;
          return;
        }
        window.ga('send', 'pageview', { page: $location.url() });
      });
    };

  }).run(function(googleAnalyticsSrv) {
    if (window.ga) {
      googleAnalyticsSrv.init();
    }
  });
});
