///<reference path="../../headers/common.d.ts" />

import config = require('app/core/config');
import angular from 'angular';
import * as _ from 'lodash';

export class AppEditCtrl {
  appModel: any;

  /** @ngInject */
  constructor(private appSrv: any, private $routeParams: any) {}

  init() {
    this.appModel = {};
    this.appSrv.get(this.$routeParams.type).then(result => {
      this.appModel = _.clone(result);
    });
  }

  update() {
    this.appSrv.update(this.appModel).then(function() {
      window.location.href = config.appSubUrl + "org/apps";
    });
  }
}

angular.module('grafana.controllers').controller('AppEditCtrl', AppEditCtrl);
