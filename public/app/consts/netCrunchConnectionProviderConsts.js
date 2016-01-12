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
      API_NAME: '/ncapi/',

      ERROR_SERVER_API : 1,
      ERROR_SERVER_VER : 2,
      ERROR_CONNECTION_INIT : 3,
      ERROR_AUTHENTICATION : 4
    });
});
