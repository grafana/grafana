///<reference path="../../headers/common.d.ts" />

import config = require('app/core/config');
import angular from 'angular';

export class AppEditCtrl {

  /** @ngInject */
  constructor(private $scope: any, private appSrv: any, private $routeParams: any) {

    $scope.init = function() {
      $scope.current = {};
      $scope.getApps();
    };

    $scope.getApps = function() {
      appSrv.get($routeParams.type).then(function(result) {
        $scope.current = _.clone(result);
      });
    };

    $scope.update = function() {
      $scope._update();
    };

    $scope._update = function() {
      appSrv.update($scope.current).then(function() {
        window.location.href = config.appSubUrl + "org/apps";
      });
    };

    $scope.init();
  }

}

angular.module('grafana.controllers').controller('AppEditCtrl', AppEditCtrl);
