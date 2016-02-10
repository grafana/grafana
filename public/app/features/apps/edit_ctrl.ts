///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';

export class AppEditCtrl {
  appModel: any;
  appId: any;
  includedPanels: any;
  includedDatasources: any;

  /** @ngInject */
  constructor(private backendSrv: any, private $routeParams: any) {
    this.appModel = {};
    this.appId = $routeParams.appId;

    this.backendSrv.get(`/api/org/apps/${this.appId}/settings`).then(result => {
      this.appModel = result;
      this.includedPanels = _.where(result.includes, {type: 'panel'});
      this.includedDatasources = _.where(result.includes, {type: 'datasource'});
    });
  }

  update() {
    var updateCmd = _.extend({
      appId: this.appModel.appId,
      orgId: this.appModel.orgId,
      enabled: this.appModel.enabled,
      pinned: this.appModel.pinned,
      jsonData: this.appModel.jsonData,
      secureJsonData: this.appModel.secureJsonData,
    }, {});

    this.backendSrv.post(`/api/org/apps/${this.appId}/settings`, updateCmd).then(function() {
      window.location.href = window.location.href;
    });
  }

  toggleEnabled() {
    this.update();
  }

  togglePinned() {
    this.update();
  }
}

angular.module('grafana.controllers').controller('AppEditCtrl', AppEditCtrl);

