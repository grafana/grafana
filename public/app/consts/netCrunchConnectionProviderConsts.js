/*****************************************************************
 *
 * Author   : Bogusław Gorczyca
 * Created  : 2016-01-11 10:15
 *
 * 2015 Copyright AdRem Software, all rights reserved
 *
 *****************************************************************/

define([
    'angular'
  ],

  function (angular) {

    'use strict';

    angular.module('grafana.const').constant('netCrunchConnectionProviderConsts', {
      API_NAME: '/ncapi/'
    });
});
