import { GridPos } from '@grafana/schema';

import { PluginsAPIDashboardModel, PluginsAPIDashboardSrv, PluginsAPIPanelModel } from './types';

class PluginsAPIPanelModelWrapper implements PluginsAPIPanelModel {
  #panel: PluginsAPIPanelModel;
  constructor(panel: PluginsAPIPanelModel) {
    this.#panel = panel;
  }

  get id() {
    return this.#panel.id;
  }
  get title() {
    return this.#panel.title || '';
  }
  get type() {
    return this.#panel.type;
  }
  get gridPos() {
    return this.#panel.gridPos;
  }
  get options() {
    return this.#panel.options;
  }

  set id(id: number) {
    this.#panel.id = id;
  }

  set title(title: string) {
    this.#panel.title = title;
  }

  set type(_) {
    throw new Error('Cannot set type on a panel');
  }

  set gridPos(gridPos: GridPos) {
    this.#panel.gridPos = gridPos;
  }

  set options(options: unknown) {
    this.#panel.options = options;
  }

  refresh() {
    this.#panel.refresh();
  }
}

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
