import { VizPanel, SceneGridRow, sceneGraph, SceneGridLayout, behaviors } from '@grafana/scenes';

import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { DashboardGridItem } from '../scene/DashboardGridItem';
import { DashboardScene } from '../scene/DashboardScene';
import { VizPanelLinks } from '../scene/PanelLinks';

import { getPanelIdForVizPanel } from './utils';

function getTimePicker(scene: DashboardScene) {
  return scene.state.controls?.state.timePicker;
}

function getRefreshPicker(scene: DashboardScene) {
  return scene.state.controls?.state.refreshPicker;
}

function getPanelLinks(panel: VizPanel) {
  if (
    panel.state.titleItems &&
    Array.isArray(panel.state.titleItems) &&
    panel.state.titleItems[0] instanceof VizPanelLinks
  ) {
    return panel.state.titleItems[0];
  }

  return null;
}

function getVizPanels(scene: DashboardScene): VizPanel[] {
  const panels: VizPanel[] = [];

  scene.state.body.forEachChild((child) => {
    if (!(child instanceof DashboardGridItem) && !(child instanceof SceneGridRow)) {
      throw new Error('Child is not a DashboardGridItem or SceneGridRow, invalid scene');
    }

    if (child instanceof DashboardGridItem) {
      if (child.state.body instanceof VizPanel) {
        panels.push(child.state.body);
      }
    } else if (child instanceof SceneGridRow) {
      child.forEachChild((child) => {
        if (child instanceof DashboardGridItem) {
          if (child.state.body instanceof VizPanel) {
            panels.push(child.state.body);
          }
        }
      });
    }
  });

  return panels;
}

function getDataLayers(scene: DashboardScene): DashboardDataLayerSet {
  const data = sceneGraph.getData(scene);

  if (!(data instanceof DashboardDataLayerSet)) {
    throw new Error('DashboardDataLayerSet not found');
  }

  return data;
}

export function getCursorSync(scene: DashboardScene) {
  const cursorSync = scene.state.$behaviors?.find((b) => b instanceof behaviors.CursorSync);

  if (cursorSync instanceof behaviors.CursorSync) {
    return cursorSync;
  }

  return;
}

export function getNextPanelId(dashboard: DashboardScene): number {
  let max = 0;
  const body = dashboard.state.body;

  if (!(body instanceof SceneGridLayout)) {
    throw new Error('Dashboard body is not a SceneGridLayout');
  }

  for (const child of body.state.children) {
    if (child instanceof DashboardGridItem) {
      const vizPanel = child.state.body;

      if (vizPanel) {
        const panelId = getPanelIdForVizPanel(vizPanel);

        if (panelId > max) {
          max = panelId;
        }
      }
    }

    if (child instanceof SceneGridRow) {
      //rows follow the same key pattern --- e.g.: `panel-6`
      const panelId = getPanelIdForVizPanel(child);

      if (panelId > max) {
        max = panelId;
      }

      for (const rowChild of child.state.children) {
        if (rowChild instanceof DashboardGridItem) {
          const vizPanel = rowChild.state.body;

          if (vizPanel) {
            const panelId = getPanelIdForVizPanel(vizPanel);

            if (panelId > max) {
              max = panelId;
            }
          }
        }
      }
    }
  }

  return max + 1;
}

export const dashboardSceneGraph = {
  getTimePicker,
  getRefreshPicker,
  getPanelLinks,
  getVizPanels,
  getDataLayers,
  getNextPanelId,
  getCursorSync,
};
