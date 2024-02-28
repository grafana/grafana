import { VizPanel, SceneGridItem, SceneGridRow, SceneDataLayers, sceneGraph, SceneGridLayout } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { LibraryVizPanel } from '../scene/LibraryVizPanel';
import { VizPanelLinks } from '../scene/PanelLinks';

import { getPanelIdForLibraryVizPanel, getPanelIdForVizPanel } from './utils';

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

  throw new Error('VizPanelLinks links not found');
}

function getVizPanels(scene: DashboardScene): VizPanel[] {
  const panels: VizPanel[] = [];

  scene.state.body.forEachChild((child) => {
    if (child instanceof SceneGridItem) {
      if (child.state.body instanceof VizPanel) {
        panels.push(child.state.body);
      }
    } else if (child instanceof SceneGridRow) {
      child.forEachChild((child) => {
        if (child instanceof SceneGridItem) {
          if (child.state.body instanceof VizPanel) {
            panels.push(child.state.body);
          }
        }
      });
    }
  });

  return panels;
}

function getDataLayers(scene: DashboardScene): SceneDataLayers {
  const data = sceneGraph.getData(scene);

  if (!(data instanceof SceneDataLayers)) {
    throw new Error('SceneDataLayers not found');
  }

  return data;
}

export function getNextPanelId(dashboard: DashboardScene): number {
  let max = 0;
  const body = dashboard.state.body;

  if (!(body instanceof SceneGridLayout)) {
    throw new Error('Dashboard body is not a SceneGridLayout');
  }

  for (const child of body.state.children) {
    if (child instanceof SceneGridItem) {
      const vizPanel = child.state.body;

      if (vizPanel) {
        const panelId =
          vizPanel instanceof LibraryVizPanel
            ? getPanelIdForLibraryVizPanel(vizPanel)
            : getPanelIdForVizPanel(vizPanel);

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
        if (rowChild instanceof SceneGridItem) {
          const vizPanel = rowChild.state.body;

          if (vizPanel) {
            const panelId =
              vizPanel instanceof LibraryVizPanel
                ? getPanelIdForLibraryVizPanel(vizPanel)
                : getPanelIdForVizPanel(vizPanel);

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
};
