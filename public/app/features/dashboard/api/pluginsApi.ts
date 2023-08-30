import {
  PluginsAPIDashboardSrv as PluginsAPIDashboardSrvInterface,
  PluginsAPIPanelModel as PluginsAPIPanelModelInterface,
} from '@grafana/runtime';
import { GridPos } from '@grafana/schema';

import { getDashboardSrv } from '../services/DashboardSrv';
import { PanelModel } from '../state';

// using a weakmap to prevent memory leak in forgotten panel wrapperes and destroyed panel models
let panelsMap = new WeakMap<PluginsAPIPanelModelInterface, PanelModel>();

/**
 * This is a wrapper for the DashboardSrv that is used by plugins to interact with
 * dashboards and panels.
 *
 * This wrapper has a limited set of functionality and doesn't directly expose the DashboardSrv
 * from grafana-core code. We want to keep it that way.
 *
 */
export class PluginsAPIDashboardSrv implements PluginsAPIDashboardSrvInterface {
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

    //return a wrapper for each panel. Do not return the grafana-core panel
    return currentDashboard.panels.map((panel) => {
      const panelWrapper = new PluginsAPIPanelModel();
      // store the original panel in a symbol for later retrieval
      panelsMap.set(panelWrapper, panel);
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
      const originalPanel = panelsMap.get(panel);
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
    currentDashboard.render();
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
  #getCorePanel(): PanelModel {
    const panel = panelsMap.get(this);
    if (!panel) {
      throw new Error('Panel no longer available');
    }
    return panel;
  }

  get id() {
    return this.#getCorePanel().id;
  }
  get title() {
    return this.#getCorePanel().title;
  }
  get type() {
    return this.#getCorePanel().type;
  }
  get gridPos() {
    return this.#getCorePanel().gridPos;
  }
  get options() {
    return this.#getCorePanel().options;
  }

  set id(id: number) {
    this.#getCorePanel().id = id;
  }

  set title(title: string) {
    this.#getCorePanel().title = title;
  }

  set type(_) {
    throw new Error('Cannot set type on a panel');
  }

  set gridPos(gridPos: GridPos) {
    this.#getCorePanel().gridPos = gridPos;
  }

  set options(options: { [key: string]: unknown }) {
    this.#getCorePanel().options = options;
  }

  refresh() {
    this.#getCorePanel().refresh();
  }
}
