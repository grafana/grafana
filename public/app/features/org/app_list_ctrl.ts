///<reference path="../../headers/common.d.ts" />

import config = require('app/core/config');
import angular from 'angular';

export class AppListCtrl {

  /** @ngInject */
  constructor($scope: any, appSrv: any, $location: any) {

    $scope.init = function() {
      $scope.apps = {};
      $scope.getApps();
    };

    $scope.getApps = function() {
      appSrv.getAll().then(function(result) {
        $scope.apps = result;
      });
    };

    $scope.update = function(app) {
      appSrv.update(app).then(function() {
        window.location.href = config.appSubUrl + $location.path();
      });
    };

    $scope.init();
  }
}

angular.module('grafana.controllers').controller('AppListCtrl', AppListCtrl);
