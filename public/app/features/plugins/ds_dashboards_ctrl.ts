import { coreModule } from 'app/core/core';
import { store } from 'app/store/configureStore';
import { getNavModel } from 'app/core/selectors/navModel';
import { buildNavModel } from './state/navModel';

export class DataSourceDashboardsCtrl {
  datasourceMeta: any;
  navModel: any;
  current: any;

  /** @ngInject */
  constructor(private backendSrv, private $routeParams) {
    const state = store.getState();
    this.navModel = getNavModel(state.navIndex, 'datasources');

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
    this.navModel = buildNavModel(this.current, this.datasourceMeta, 'datasource-dashboards');
  }

  getPluginInfo() {
    return this.backendSrv.get('/api/plugins/' + this.current.type + '/settings').then(pluginInfo => {
      this.datasourceMeta = pluginInfo;
      this.updateNav();
    });
  }
}

coreModule.controller('DataSourceDashboardsCtrl', DataSourceDashboardsCtrl);
