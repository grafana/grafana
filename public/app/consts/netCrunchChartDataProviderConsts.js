/*****************************************************************
 *
 * Author   : Bogusław Gorczyca
 * Created  : 2015-08-25 13:47
 *
 * 2015 Copyright AdRem Software, all rights reserved
 *
 *****************************************************************/

/* global angular, console */

define([
    'angular',
    'lodash'
  ],

  function (angular) {

    'use strict';

    angular.module('grafana.const').constant('netCrunchChartDataProviderConsts', {
      DEFAULT_MAX_SAMPLE_COUNT: 200
    })
});
