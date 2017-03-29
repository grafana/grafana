define([
  'angular',
  'lodash',
  'config',
],
function (angular) {
  'use strict';
  var module = angular.module('grafana.services');

  module.service('integrateSrv',function () {
    return {
        format : {}
    }
  });
});