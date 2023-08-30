import {
  PluginsAPIDashboardSrv as PluginsAPIDashboardSrvInterface,
  PluginsAPIPanelModel as PluginsAPIPanelModelInterface,
} from '@grafana/runtime';
import { GridPos } from '@grafana/schema';

import { getDashboardSrv } from '../services/DashboardSrv';
import { PanelModel } from '../state';

/**
 * This is a wrapper for the DashboardSrv that is used by plugins to interact with
 * dashboards and panels.
 *
 * This wrapper has a limited set of functionality and doesn't directly expose the DashboardSrv
 * from grafana-core code. We want to keep it that way.
 *
 */
export class PluginsAPIDashboardSrv implements PluginsAPIDashboardSrvInterface {
  // store plugin panel references in a weakmap to avoid memory leaks
  #panelsMap = new WeakMap<PluginsAPIPanelModelInterface, PanelModel>();

  get dashboardUid() {
    return getDashboardSrv().getCurrent()?.uid ?? '';
  }

  get dashboardTitle() {
    return getDashboardSrv().getCurrent()?.title ?? '';
  }

  getPanels() {
    const currentDashboard = getDashboardSrv().getCurrent();
    if (!currentDashboard) {
      return [];
    }

    // reset the weakmap
    this.#panelsMap = new WeakMap();

    //return a wrapper for each panel. Do not return the grafana-core panel
    return currentDashboard.panels.map((panel) => {
      const panelWrapper = new PluginsAPIPanelModel(panel);
      // store the original panel in a symbol for later retrieval
      this.#panelsMap.set(panelWrapper, panel);
      return panelWrapper;
    });
  }

  updatePanels(panels: PluginsAPIPanelModelInterface[]) {
    const currentDashboard = getDashboardSrv().getCurrent();
    if (!currentDashboard) {
      return;
    }
    const panelsToSet: PanelModel[] = panels.map((panel) => {
      // if it is a panel wrapper, get the original from the panels map
      const originalPanel = this.#panelsMap.get(panel);
      if (originalPanel) {
        return originalPanel;
      }
      // a custom panel object from user-input
      // there are cases where the panel object comes from an http call to
      // the backend. This checks the panel is somewhat valid.
      if (isValidPanelModel(panel)) {
        return panel;
      }
      throw new Error('Invalid panel');
    });
    currentDashboard?.updatePanels(panelsToSet);
  }
}

/**
 * Validates that a passed panel is compliant with the schema
 * This validation is yet far from complete and will be expanded
 */
function isValidPanelModel(panel: PluginsAPIPanelModelInterface): panel is PanelModel {
  const fields = ['id', 'title', 'type', 'fieldConfig'];
  return fields.every((field) => field in panel);
}

export class PluginsAPIPanelModel implements PluginsAPIPanelModelInterface {
  // use a hashed private field to prevent runtime access to the panel
  #panel: PanelModel;

  constructor(panel: PanelModel) {
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

  set options(options: { [key: string]: unknown }) {
    this.#panel.options = options;
  }

  refresh() {
    this.#panel.refresh();
  }
}
