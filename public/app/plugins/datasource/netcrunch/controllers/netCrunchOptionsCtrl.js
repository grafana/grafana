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

      $scope.init = function(){
        $scope.panel = $scope.datasource.updatePanel($scope.panel);
      };

      $scope.metricOptionsChange = function (options){
        $scope.get_data();
      };

      $scope.defaultMaxDataPoints = netCrunchTrendDataProviderConsts.DEFAULT_MAX_SAMPLE_COUNT;
    });
});
