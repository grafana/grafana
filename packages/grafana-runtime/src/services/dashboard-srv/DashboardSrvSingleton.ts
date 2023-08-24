import { PluginsAPIPanelModelWrapper } from './PanelWrapper';
import { PluginsAPIDashboardModel, PluginsAPIDashboardSrv, PluginsAPIPanelModel } from './types';

export class PluginsAPIDashboardModelWrapper implements PluginsAPIDashboardModel {
  #dashboard: PluginsAPIDashboardModel | undefined;

  // store panel references in a weakmap to avoid memory leaks
  #panelsMap = new WeakMap<PluginsAPIPanelModel, PluginsAPIPanelModel>();
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

    // reset the weakmap
    this.#panelsMap = new WeakMap();

    //return a proxy for each panel, cached if exists
    return this.#dashboard.panels.map((panel) => {
      const panelWrapper = new PluginsAPIPanelModelWrapper(panel);
      // store the original panel in a symbol that can't be accessed directly
      this.#panelsMap.set(panelWrapper, panel);
      return panelWrapper;
    });
  }

  set panels(panels: PluginsAPIPanelModel[]) {
    if (!this.#dashboard) {
      return;
    }
    const panelsToSet = panels.map((panel) => {
      // if it is a panel wrapper, unwrap it
      if (this.#panelsMap.has(panel)) {
        return this.#panelsMap.get(panel)!;
      }
      // a custom panel object
      return panel;
    });
    this.#dashboard.panels = panelsToSet;
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
