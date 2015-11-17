define([
    'angular',
    'jquery'
  ],
  function (angular, $) {
    "use strict";

    var module = angular.module('grafana.routes');

    module.controller('AdHocPanelCtrl', function ($scope, $routeParams, $location, $timeout, panelSrv,
                                                  dashboardSrv, dashboardViewStateSrv, contextSrv, timeSrv) {
      $scope.row = {
        height: $(window).height() + 'px'
      };
      var docHeight = $(window).height();
      $scope.height = Math.floor(docHeight * 0.7);

      $scope.$index = 0;
      $scope.panel = {
        id: -1,
        title: 'Ad hoc',
        error: false,
        span: 12,
        editable: true,
        type: $routeParams.type
      };

      $scope.dashboard = dashboardSrv.create({}, {});
      $scope.dashboardMeta = {
        canEdit: true
      };
      dashboardSrv.setCurrent($scope.dashboard);
      timeSrv.init($scope.dashboard);

      $scope.dashboardViewState = dashboardViewStateSrv.create($scope);

      $scope.editMode = true;
      $scope.dashboardViewState.registerPanel($scope);
      $scope.dashboardViewState.update({fullscreen: true, edit: true, panelId: -1});

    });

  });
