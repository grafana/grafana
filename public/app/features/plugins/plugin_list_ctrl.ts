///<reference path="../../headers/common.d.ts" />

import angular from 'angular';

export class PluginListCtrl {
  plugins: any[];
  tabIndex: number;
  navModel: any;

  /** @ngInject */
  constructor(private backendSrv: any, $location, navModelSrv) {
    this.tabIndex = 0;
    this.navModel = navModelSrv.getPluginsNav();

    var pluginType = $location.search().type || 'panel';
    switch (pluginType) {
      case "datasource":  {
        this.tabIndex = 1;
        break;
      }
      case "app": {
        this.tabIndex = 2;
        break;
      }
      case "panel":
      default:
        this.tabIndex = 0;
    }

    this.backendSrv.get('api/plugins', {embedded: 0, type: pluginType}).then(plugins => {
      this.plugins = plugins;
    });
  }
}

angular.module('grafana.controllers').controller('PluginListCtrl', PluginListCtrl);
