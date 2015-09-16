/*****************************************************************
 *
 * Author   : Bogusław Gorczyca
 * Created  : 2015-08-21 14:58
 *
 * 2015 Copyright AdRem Software, all rights reserved
 *
 *****************************************************************/

define([
    'angular'
  ],

  function (angular) {

    'use strict';

    angular.module('grafana.const').constant('netCrunchCounterConsts', {
      CNT_TYPE: {
        cstXML: 1,
        cstMIB: 2,
        cstSimple: 3
      },

      SNMP_INSTANCE_TYPE: {
        sitValue: 1,
        sitNone: 2,
        sitByIndex: 3,
        sitByLookup: 4,
        sitComputable: 5
      },

      SNMP_FUNC: {
        scfUnknown: 1,
        scfSum: 2,
        scfMin: 3,
        scfMax: 4,
        scfAvg: 5,
        scfCount: 6
      }
    });

  });
