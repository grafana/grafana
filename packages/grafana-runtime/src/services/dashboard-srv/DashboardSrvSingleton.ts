import { PluginsAPIPanelModelWrapper } from './PanelWrapper';
import { PluginsAPIDashboardModel, PluginsAPIDashboardSrv } from './types';

export class PluginsAPIDashboardModelWrapper implements PluginsAPIDashboardModel {
  #dashboard: PluginsAPIDashboardModel | undefined;
  setCurrentDashboard(dashboard: PluginsAPIDashboardModel) {
    this.#dashboard = dashboard;
  }

  get uid() {
    return this.#dashboard?.uid ?? '';
  }

  get title() {
    return this.#dashboard?.title ?? '';
  }

  get panels() {
    if (!this.#dashboard) {
      return [];
    }

    //return a proxy for each panel, cached if exists
    return this.#dashboard.panels.map((panel) => {
      return new PluginsAPIPanelModelWrapper(panel);
    });
  }
}

export class PluginsAPIDashboardSrvSingleton implements PluginsAPIDashboardSrv {
  // This is the original internal grafana-core dashboard service singleton
  // we don't want to expose this to the public API
  #internalSingletonInstance: PluginsAPIDashboardSrv;
  #dashboardWrapper: PluginsAPIDashboardModelWrapper;

  constructor(instance: Partial<PluginsAPIDashboardSrv>) {
    this.#internalSingletonInstance = instance;
    this.#dashboardWrapper = new PluginsAPIDashboardModelWrapper();
  }

  get dashboard(): PluginsAPIDashboardModel | undefined {
    if (!this.#internalSingletonInstance.dashboard) {
      return undefined;
    }
    this.#dashboardWrapper.setCurrentDashboard(this.#internalSingletonInstance.dashboard);
    return this.#dashboardWrapper;
  }
}
