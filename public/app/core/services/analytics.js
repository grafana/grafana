define([
  'angular',
  '../core_module',
],
function(angular, coreModule) {
  'use strict';

  coreModule.service('googleAnalyticsSrv', function($rootScope, $location) {
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
