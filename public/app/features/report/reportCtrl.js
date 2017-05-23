define([
    'angular',
    'lodash',
    'app/core/utils/datemath'
  ],
  function (angular, _, dateMath) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('ReportCtrl', function (
      $scope, backendSrv, contextSrv, datasourceSrv) {
      $scope.init = function () {
        $scope.hasReport = false;
        $scope.reportUrl = '';
        $scope.reportName = '';
        switch(contextSrv.user.orgId) {
          case 3: {
            $scope.reportUrl = 'https://download.cloudwiz.cn/report/Report20170314.pdf';
            $scope.hasReport = true;
            $scope.reportName = '报告20170314.pdf';
            break;
          }
          case 7: {
            $scope.hasReport = true;
            $scope.reportUrl = 'https://download.cloudwiz.cn/report/Report20170522.pdf';
            $scope.reportName = '报告20170522.pdf';
            break;
          }
          default: {
            $scope.reportUrl = '';
            break;
          }
        }
      };
      $scope.init();
    });
  });
