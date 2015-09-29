/***************************************************************
 *
 * Author   : boguslaw.gorczyca
 * Created  : 2015-09-28
 *
 * 2015 Copyright AdRem Software, all rights reserved
 *
 ****************************************************************/

define([
    'angular'
  ],

  function (angular) {
    'use strict';

    var module = angular.module('grafana.directives');

    module.directive('metricQueryEditorNetcrunch', function() {
      return {
        controller: 'netCrunchQueryCtrl',
        templateUrl: 'app/plugins/datasource/netcrunch/partials/query.editor.html'
      };
    });

    module.directive('metricQueryOptionsNetcrunch', function() {
      return {
        templateUrl: 'app/plugins/datasource/netcrunch/partials/query.options.html'
      };
    });

  });
