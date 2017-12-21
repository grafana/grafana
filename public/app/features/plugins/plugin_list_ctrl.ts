import angular from 'angular';
import _ from 'lodash';

export class PluginListCtrl {
  plugins: any[];
  tabIndex: number;
  navModel: any;
  searchQuery: string;
  allPlugins: any[];

  /** @ngInject */
  constructor(private backendSrv: any, $location, navModelSrv) {
    this.tabIndex = 0;
    this.navModel = navModelSrv.getNav('cfg', 'plugins', 0);

    this.backendSrv.get('api/plugins', { embedded: 0 }).then(plugins => {
      this.plugins = plugins;
      this.allPlugins = plugins;
    });
  }

  onQueryUpdated() {
    let regex = new RegExp(this.searchQuery, 'ig');
    this.plugins = _.filter(this.allPlugins, item => {
      return regex.test(item.name) || regex.test(item.type);
    });
  }
}

angular.module('grafana.controllers').controller('PluginListCtrl', PluginListCtrl);
