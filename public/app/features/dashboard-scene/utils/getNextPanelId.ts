import { SceneGridItem, SceneGridLayout, SceneGridRow, SceneObject, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { PanelRepeaterGridItem } from '../scene/PanelRepeaterGridItem';

import { getPanelIdForVizPanel } from './utils';

export class NextPanelIdGenerator {
  private _usedIds = new Set<number>();
  private _nextId = 1;

  constructor(dashboard: DashboardScene) {
    const grid = dashboard.state.body;

    if (grid instanceof SceneGridLayout) {
      for (const child of grid.state.children) {
        this._checkLayoutItem(child);
      }
    }
  }

  private _checkLayoutItem(layoutItem: SceneObject) {
    if (layoutItem instanceof SceneGridItem) {
      if (layoutItem.state.body instanceof VizPanel) {
        this._checkPanel(layoutItem.state.body);
      }
      return;
    }

    if (layoutItem instanceof SceneGridRow) {
      for (const rowChild of layoutItem.state.children) {
        this._checkLayoutItem(rowChild);
      }
      return;
    }

    if (layoutItem instanceof PanelRepeaterGridItem && layoutItem.state.repeatedPanels) {
      for (const repeat of layoutItem.state.repeatedPanels) {
        this._checkPanel(repeat);
      }
      return;
    }
  }

  private _checkPanel(vizPanel: VizPanel) {
    const panelId = getPanelIdForVizPanel(vizPanel);
    if (typeof panelId === 'number') {
      this._usedIds.add(panelId);
    }
  }

  public getNextId() {
    while (this._usedIds.has(this._nextId)) {
      this._nextId++;
    }
    this._usedIds.add(this._nextId);
    return this._nextId;
  }
}
