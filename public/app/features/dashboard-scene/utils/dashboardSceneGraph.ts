import { VizPanel, sceneGraph, behaviors, SceneObject, SceneGridRow } from '@grafana/scenes';

import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { DashboardScene } from '../scene/DashboardScene';
import { VizPanelLinks } from '../scene/PanelLinks';

import { getDashboardSceneFor, getLayoutManagerFor, getPanelIdForVizPanel, getVizPanelKeyForPanelId } from './utils';

function getTimePicker(scene: DashboardScene) {
  return scene.state.controls?.state.timePicker;
}

function getRefreshPicker(scene: DashboardScene) {
  return scene.state.controls?.state.refreshPicker;
}

function getPanelLinks(panel: VizPanel) {
  if (panel.state.titleItems && Array.isArray(panel.state.titleItems)) {
    // search panel.state.titleItems for VizPanelLinks
    const panelLink = panel.state.titleItems.find((item) => item instanceof VizPanelLinks);
    return panelLink ?? null;
  }

  return null;
}

function getVizPanels(scene: DashboardScene): VizPanel[] {
  return scene.state.body.getVizPanels();
}

/**
 * Will look for all panels in the entire scene starting from root
 * and find the next free panel id
 */
export function getNextPanelId(scene: SceneObject): number {
  let max = 0;

  sceneGraph
    .findAllObjects(
      scene.getRoot(),
      (obj) => (obj instanceof VizPanel || obj instanceof SceneGridRow) && !obj.state.repeatSourceKey
    )
    .forEach((panel) => {
      const panelId = getPanelIdForVizPanel(panel);
      if (panelId > max) {
        max = panelId;
      }
    });

  return max + 1;
}

function getDataLayers(scene: DashboardScene): DashboardDataLayerSet {
  const data = sceneGraph.getData(scene);

  if (!(data instanceof DashboardDataLayerSet)) {
    throw new Error('DashboardDataLayerSet not found');
  }

  return data;
}

function getAllSelectedObjects(scene: SceneObject): SceneObject[] {
  return (
    getDashboardSceneFor(scene)
      .state.editPane.state.selection?.getSelectionEntries()
      .map(([, ref]) => ref.resolve()) ?? []
  );
}

export function getCursorSync(scene: DashboardScene) {
  const cursorSync = scene.state.$behaviors?.find((b) => b instanceof behaviors.CursorSync);

  if (cursorSync instanceof behaviors.CursorSync) {
    return cursorSync;
  }

  return;
}
// Functions to manage the lookup table in dashboard scene that will hold element_identifer : panel_id
export function getElementIdentifierForVizPanel(vizPanel: VizPanel): string {
  const scene = getDashboardSceneFor(vizPanel);
  const panelId = getPanelIdForVizPanel(vizPanel);
  let elementKey = scene.serializer.getElementIdForPanel(panelId);

  if (!elementKey) {
    // assign a panel-id key
    elementKey = getVizPanelKeyForPanelId(panelId);
  }
  return elementKey;
}

export const dashboardSceneGraph = {
  getTimePicker,
  getRefreshPicker,
  getPanelLinks,
  getVizPanels,
  getDataLayers,
  getAllSelectedObjects,
  getCursorSync,
  getLayoutManagerFor,
  getNextPanelId,
  getElementIdentifierForVizPanel,
};
