import { VizPanel, SceneGridRow, sceneGraph, SceneGridLayout, behaviors } from '@grafana/scenes';

import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { DashboardGridItem } from '../scene/DashboardGridItem';
import { DashboardScene } from '../scene/DashboardScene';
import { LibraryVizPanel } from '../scene/LibraryVizPanel';
import { VizPanelLinks } from '../scene/PanelLinks';

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
  return dashboard.state.body.getNextPanelId();
}

// Returns the LibraryVizPanel that corresponds to the given VizPanel if it exists
export const getLibraryVizPanelFromVizPanel = (vizPanel: VizPanel): LibraryVizPanel | null => {
  if (vizPanel.parent instanceof LibraryVizPanel) {
    return vizPanel.parent;
  }

  if (vizPanel.parent instanceof DashboardGridItem && vizPanel.parent.state.body instanceof LibraryVizPanel) {
    return vizPanel.parent.state.body;
  }

  return null;
};

export const dashboardSceneGraph = {
  getTimePicker,
  getRefreshPicker,
  getPanelLinks,
  getVizPanels,
  getDataLayers,
  getNextPanelId,
  getCursorSync,
};
