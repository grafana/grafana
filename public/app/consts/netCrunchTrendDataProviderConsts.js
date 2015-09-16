/*****************************************************************
 *
 * Author   : Bogusław Gorczyca
 * Created  : 2015-08-25 13:47
 *
 * 2015 Copyright AdRem Software, all rights reserved
 *
 *****************************************************************/

define([
    'angular'
  ],

  function (angular) {

    'use strict';

    angular.module('grafana.const').constant('netCrunchTrendDataProviderConsts', {
      DEFAULT_MIN_MAX_SAMPLE_COUNT: 10,
      DEFAULT_MAX_SAMPLE_COUNT: 200,
      DEFAULT_MAX_MAX_SAMPLE_COUNT: 5000
    });
  });
