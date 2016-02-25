///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';

export class PluginEditCtrl {
  model: any;
  pluginId: any;
  includedPanels: any;
  includedDatasources: any;

  /** @ngInject */
  constructor(private backendSrv: any, private $routeParams: any) {
    this.model = {};
    this.pluginId = $routeParams.pluginId;

    this.backendSrv.get(`/api/org/plugins/${this.pluginId}/settings`).then(result => {
      this.model = result;
      this.includedPanels = _.where(result.includes, {type: 'panel'});
      this.includedDatasources = _.where(result.includes, {type: 'datasource'});
    });
  }

  update() {
    var updateCmd = _.extend({
      pluginId: this.model.pluginId,
      orgId: this.model.orgId,
      enabled: this.model.enabled,
      pinned: this.model.pinned,
      jsonData: this.model.jsonData,
      secureJsonData: this.model.secureJsonData,
    }, {});

    this.backendSrv.post(`/api/org/plugins/${this.pluginId}/settings`, updateCmd).then(function() {
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

angular.module('grafana.controllers').controller('PluginEditCtrl', PluginEditCtrl);

