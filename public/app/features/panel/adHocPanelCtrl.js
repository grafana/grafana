define([
    'angular',
    'jquery',
  ],
  function (angular, $) {
    "use strict";

    var module = angular.module('grafana.routes');

    module.controller('AdHocPanelCtrl', function ($scope, $routeParams, $location, $timeout, panelSrv, dashboardSrv, contextSrv, timeSrv) {

      $scope.row = {
        height: $(window).height() + 'px'
      };

      $scope.$index = 0;
      $scope.panel = {
        title: 'Ad hoc',
        error: false,
        span: 12,
        editable: true,
        type: $routeParams.type
      };

      $scope.dashboard = dashboardSrv.create({}, {});
      dashboardSrv.setCurrent($scope.dashboard);
      timeSrv.init($scope.dashboard);

      $scope.dashboardViewState = {
        registerPanel: function () {
        }, state: {}
      };

      var docHeight = $(window).height();

      $scope.editMode = true;
      $scope.height = Math.floor(docHeight * 0.7);

    });

  });
