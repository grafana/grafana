import { PluginsAPIPanelModelWrapper } from './PanelWrapper';
import {
  CoreDashboardModel,
  CoreDashboardSrv,
  CorePanelModel,
  PluginsAPIDashboardModel,
  PluginsAPIDashboardSrv,
  PluginsAPIPanelModel,
} from './types';

export class PluginsAPIDashboardModelWrapper implements PluginsAPIDashboardModel {
  #dashboard: CoreDashboardModel | undefined;

  // store panel references in a weakmap to avoid memory leaks
  #panelsMap = new WeakMap<PluginsAPIPanelModel, CorePanelModel>();
  setCurrentDashboard(dashboard: CoreDashboardModel) {
    this.#dashboard = dashboard;
  }

  get uid() {
    return this.#dashboard?.uid ?? '';
  }

  get title() {
    return this.#dashboard?.title ?? '';
  }

  get panels() {
    return this.getPanels();
  }

  getPanels() {
    if (!this.#dashboard) {
      return [];
    }

    // reset the weakmap
    this.#panelsMap = new WeakMap();

    //return a wrapper for each panel
    return this.#dashboard.panels.map((panel) => {
      const panelWrapper = new PluginsAPIPanelModelWrapper(panel);
      // store the original panel in a symbol that can't be accessed directly
      this.#panelsMap.set(panelWrapper, panel);
      return panelWrapper;
    });
  }

  updatePanels(panels: PluginsAPIPanelModel[]) {
    if (!this.#dashboard) {
      return;
    }
    const panelsToSet: CorePanelModel[] = panels.map((panel) => {
      // if it is a panel wrapper, unwrap it
      const originalPanel = this.#panelsMap.get(panel);
      if (originalPanel) {
        return originalPanel;
      }
      // a custom panel object from user-input
      if (isCorePanelModel(panel)) {
        return panel;
      }
      throw new Error('Invalid panel');
    });
    this.#dashboard.updatePanels(panelsToSet);
  }
}

function isCorePanelModel(panel: PluginsAPIPanelModel): panel is CorePanelModel {
  return 'fieldConfig' in panel;
}

export class PluginsAPIDashboardSrvSingleton implements PluginsAPIDashboardSrv {
  // This is the original internal grafana-core dashboard service singleton
  // we don't want to expose this to the public API
  #internalSingletonInstance: CoreDashboardSrv;
  #dashboardWrapper: PluginsAPIDashboardModelWrapper;

  constructor(instance: CoreDashboardSrv) {
    if (!instance) {
      throw new Error('Can not construct a DashboardSrv with an empty object');
    }
    this.#internalSingletonInstance = instance;
    this.#dashboardWrapper = new PluginsAPIDashboardModelWrapper();
  }

  get dashboard() {
    return this.getCurrentDashboard();
  }

  getCurrentDashboard(): PluginsAPIDashboardModel | undefined {
    if (!this.#internalSingletonInstance.dashboard) {
      return undefined;
    }
    this.#dashboardWrapper.setCurrentDashboard(this.#internalSingletonInstance.dashboard);
    return this.#dashboardWrapper;
  }
}
