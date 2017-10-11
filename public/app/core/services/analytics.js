define([
  'angular',
  'jquery',
  'app/core/core_module',
  'app/core/config',
],
function(angular, $, coreModule, config) {
  'use strict';

  coreModule.default.service('googleAnalyticsSrv', function($rootScope, $location) {

    function gaInit() {
      $.getScript('https://www.google-analytics.com/analytics.js'); // jQuery shortcut
      var ga = window.ga = window.ga || function () { (ga.q = ga.q || []).push(arguments); }; ga.l = +new Date;
      ga('create', config.googleAnalyticsId, 'auto');
      return ga;
    }

    this.init = function() {

      $rootScope.$on('$viewContentLoaded', function() {
        var track =  { page: $location.url() };

        var ga = window.ga || gaInit();

        ga('set', track);
        ga('send', 'pageview');
      });

    };

  }).run(function(googleAnalyticsSrv) {

    if (config.googleAnalyticsId) {
      googleAnalyticsSrv.init();
    }

  });
});
