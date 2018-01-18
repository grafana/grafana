import { toJS } from 'mobx';
import { coreModule } from 'app/core/core';
import { store } from 'app/stores/store';

export class DataSourceDashboardsCtrl {
  datasourceMeta: any;
  navModel: any;
  current: any;

  /** @ngInject */
  constructor(private backendSrv, private $routeParams) {
    if (store.nav.main === null) {
      store.nav.load('cfg', 'datasources');
    }

    this.navModel = toJS(store.nav);

    if (this.$routeParams.id) {
      this.getDatasourceById(this.$routeParams.id);
    }
  }

  getDatasourceById(id) {
    this.backendSrv
      .get('/api/datasources/' + id)
      .then(ds => {
        this.current = ds;
      })
      .then(this.getPluginInfo.bind(this));
  }

  updateNav() {
    store.nav.initDatasourceEditNav(this.current, this.datasourceMeta, 'datasource-dashboards');
    this.navModel = toJS(store.nav);
  }

  getPluginInfo() {
    return this.backendSrv.get('/api/plugins/' + this.current.type + '/settings').then(pluginInfo => {
      this.datasourceMeta = pluginInfo;
      this.updateNav();
    });
  }
}

coreModule.controller('DataSourceDashboardsCtrl', DataSourceDashboardsCtrl);
