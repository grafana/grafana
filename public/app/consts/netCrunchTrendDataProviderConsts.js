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
      DEFAULT_MAX_MAX_SAMPLE_COUNT: 5000,

      PERIOD_TYPE : {
        tpMinutes : 0,
        tpHours : 1,
        tpDays : 2,
        tpMonths : 3
      },

      QUERY_RESULT_MASKS : {
        min : 'tqrMin',
        avg : 'tqrAvg',
        max : 'tqrMax',
        avail : 'tqrAvail',
        delta : 'tqrDelta',
        equal : 'tqrEqual',
        distr : 'tqrDistr'
      },

      QUERY_RESULT_ORDER : ['avg', 'min', 'max', 'avail', 'delta', 'equal']
    });
  });
