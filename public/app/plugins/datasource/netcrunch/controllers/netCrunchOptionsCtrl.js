/*****************************************************************
 *
 * Author   : Bogusław Gorczyca
 * Created  : 2015-09-11 16:24
 *
 * 2015 Copyright AdRem Software, all rights reserved
 *
 *****************************************************************/

/* global angular, console */

define([
    'angular'
  ],

  function (angular) {

    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('netCrunchOptionsCtrl', function($scope, netCrunchTrendDataProviderConsts) {

      function prepareMaxDataPointsPattern() {
        return /^0*([1-9][0-9]|[1-9][0-9][0-9]?|[1-4][0-9][0-9][0-9]|5000)$/
      }

      $scope.init = function() {
        $scope.panel = $scope.datasource.updatePanel($scope.panel);
      };

      $scope.metricOptionsChange = function (options) {
        $scope.get_data();
      };

      $scope.defaultMinMaxDataPoints = netCrunchTrendDataProviderConsts.DEFAULT_MIN_MAX_SAMPLE_COUNT;
      $scope.defaultMaxDataPoints = netCrunchTrendDataProviderConsts.DEFAULT_MAX_SAMPLE_COUNT;
      $scope.defaultMaxMaxDataPoints = netCrunchTrendDataProviderConsts.DEFAULT_MAX_MAX_SAMPLE_COUNT;
      $scope.maxDataPointsPattern = prepareMaxDataPointsPattern();
    });
  });
