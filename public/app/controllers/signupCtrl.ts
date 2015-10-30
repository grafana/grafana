///<reference path="../headers/common.d.ts" />

import angular = require('angular');
import config = require('app/core/config');

var module = angular.module('grafana.controllers');

export class SignUpCtrl {

  constructor(
      private $scope : any,
      private $location : any,
      private contextSrv : any,
      private backendSrv : any) {

    contextSrv.sidemenu = false;
    $scope.ctrl = this;

    $scope.formModel = {};

    var params = $location.search();
    $scope.formModel.orgName = params.email;
    $scope.formModel.email = params.email;
    $scope.formModel.username = params.email;
    $scope.formModel.code = params.code;

    $scope.verifyEmailEnabled = false;
    $scope.autoAssignOrg = false;

    backendSrv.get('/api/user/signup/options').then(options => {
      $scope.verifyEmailEnabled = options.verifyEmailEnabled;
      $scope.autoAssignOrg = options.autoAssignOrg;
    });
  }

  submit () {
    if (!this.$scope.signUpForm.$valid) {
      return;
    }

    this.backendSrv.post('/api/user/signup/step2', this.$scope.formModel).then(rsp => {
      if (rsp.code === 'redirect-to-select-org') {
        window.location.href = config.appSubUrl + '/profile/select-org?signup=1';
      } else {
        window.location.href = config.appSubUrl + '/';
      }
    });
  };
}

module.controller('SignUpCtrl', SignUpCtrl);

