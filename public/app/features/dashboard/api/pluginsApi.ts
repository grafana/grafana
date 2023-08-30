import { PluginsAPIDashboardSrv as PluginsAPIDashboardSrvInterface, PluginsAPIPanelModel } from '@grafana/runtime';
import { GridPos } from '@grafana/schema';

import { getDashboardSrv } from '../services/DashboardSrv';
import { PanelModel } from '../state';

export class PluginsAPIDashboardSrv implements PluginsAPIDashboardSrvInterface {
  // store plugin panel references in a weakmap to avoid memory leaks
  #panelsMap = new WeakMap<PluginsAPIPanelModel, PanelModel>();

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

    //return a wrapper for each panel
    return currentDashboard.panels.map((panel) => {
      const panelWrapper = new PluginsAPIPanelModelWrapper(panel);
      // store the original panel in a symbol that can't be accessed directly
      this.#panelsMap.set(panelWrapper, panel);
      return panelWrapper;
    });
  }

  updatePanels(panels: PluginsAPIPanelModel[]) {
    const currentDashboard = getDashboardSrv().getCurrent();
    if (!currentDashboard) {
      return;
    }
    const panelsToSet: PanelModel[] = panels.map((panel) => {
      // if it is a panel wrapper, unwrap it
      const originalPanel = this.#panelsMap.get(panel);
      if (originalPanel) {
        return originalPanel;
      }
      // a custom panel object from user-input
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
function isValidPanelModel(panel: PluginsAPIPanelModel): panel is PanelModel {
  return 'fieldConfig' in panel;
}

export class PluginsAPIPanelModelWrapper implements PluginsAPIPanelModel {
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
