/*****************************************************************
 *
 * Author   : Bogusław Gorczyca
 * Created  : 2015-08-21 15:30
 *
 * 2015 Copyright AdRem Software, all rights reserved
 *
 *****************************************************************/

define([
    'angular'
  ],

  function (angular) {

    'use strict';

    angular.module('grafana.values')
      .value('netCrunchCounterTypes', {
        percentage: "%",
        milliseconds: "ms",
        bytesBitsPS: "bps",
        bytesBps: "Bps",
        bytes: "bytes"
      });

  });
