define([
  'angular',
  'lodash',
  'app/core/config',
],
  function (angular, _, config) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('ServiceDepCtrl', function ($scope, $log, jsPlumbService, serviceDepSrv, alertSrv, $timeout) {
      var ctrl = this;

      // toolkit id
      var toolkitId = "demoToolkit";

      var toolkit = window.toolkit;
      var surface = window.surface;

      

      //
      // scope contains
      // jtk - the toolkit
      // surface - the surface
      //
      // element is the DOM element into which the toolkit was rendered
      //
      

    });
  }
)