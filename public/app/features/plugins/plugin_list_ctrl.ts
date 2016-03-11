///<reference path="../../headers/common.d.ts" />

import angular from 'angular';

export class PluginListCtrl {
  plugins: any[];

  /** @ngInject */
  constructor(private backendSrv: any) {

    this.backendSrv.get('api/plugins', {embedded: 0}).then(plugins => {
      this.plugins = plugins;
    });
  }
}

angular.module('grafana.controllers').controller('PluginListCtrl', PluginListCtrl);
