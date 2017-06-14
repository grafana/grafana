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
        $scope.reports = [];
        switch(contextSrv.user.orgId) {
          case 3: {
            $scope.reports.push({
              reportName: '报告20170314.pdf',
              reportUrl: 'https://download.cloudwiz.cn/report/Report20170314.pdf'
            });
            break;
          }
          case 7: {
            // wenjuan
            $scope.reports.push({
              reportName: '报告20170613.pdf',
              reportUrl: 'https://download.cloudwiz.cn/report/Report20170613.pdf'
            });
            $scope.reports.push({
              reportName: '报告20170606.pdf',
              reportUrl: 'https://download.cloudwiz.cn/report/Report20170606.pdf'
            });
            $scope.reports.push({
              reportName: '报告20170530.pdf',
              reportUrl: 'https://download.cloudwiz.cn/report/Report20170530.pdf'
            });
            $scope.reports.push({
              reportName: '报告20170522.pdf',
              reportUrl: 'https://download.cloudwiz.cn/report/Report20170522.pdf'
            });
            break;
          }
          case 11: {
            $scope.reports.push({
              reportName: '报告20170523.pdf',
              reportUrl: 'https://download.cloudwiz.cn/report/Report20170523.pdf'
            });
            break;
          }
          default: {
            $scope.reports = [];
            break;
          }
        }
      };
      $scope.init();
    });
  });
