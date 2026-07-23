import { VizPanel, sceneGraph, behaviors, type SceneObject, SceneGridRow } from '@grafana/scenes';

import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { VizPanelLinks } from '../scene/PanelLinks';
import { RowItem } from '../scene/layout-rows/RowItem';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { type DashboardSceneLike } from '../scene/types/dashboard';

import { getDashboardSceneFor, getLayoutManagerFor, getPanelIdForVizPanel, getVizPanelKeyForPanelId } from './utils';

function getTimePicker(scene: DashboardSceneLike) {
  return scene.state.controls?.state.timePicker;
}

function getRefreshPicker(scene: DashboardSceneLike) {
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

function getVizPanels(scene: DashboardSceneLike): VizPanel[] {
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

export type PanelIdGenerator = () => number;

/**
 * Returns a sequential ID generator seeded from the current max panel ID.
 * Shared across sibling layouts to prevent duplicate panel IDs during duplication.
 */
function getPanelIdGenerator(scene: SceneObject): PanelIdGenerator {
  let id = getNextPanelId(scene);
  return () => id++;
}

function getDataLayers(scene: DashboardSceneLike): DashboardDataLayerSet {
  const data = sceneGraph.getData(scene);

  if (!(data instanceof DashboardDataLayerSet)) {
    throw new Error('DashboardDataLayerSet not found');
  }

  return data;
}

function getCursorSync(scene: DashboardSceneLike) {
  const cursorSync = scene.state.$behaviors?.find((b) => b instanceof behaviors.CursorSync);

  if (cursorSync instanceof behaviors.CursorSync) {
    return cursorSync;
  }

  return;
}
// Functions to manage the lookup table in dashboard scene that will hold element_identifer : panel_id
function getElementIdentifierForVizPanel(vizPanel: VizPanel): string {
  const scene = getDashboardSceneFor(vizPanel);
  const panelId = getPanelIdForVizPanel(vizPanel);
  let elementKey = scene.serializer.getElementIdForPanel(panelId);

  if (!elementKey) {
    // assign a panel-id key
    elementKey = getVizPanelKeyForPanelId(panelId);
  }
  return elementKey;
}

/**
 * Walk up from a panel to the key of the nearest enclosing repeat-clone section (row or tab).
 * Panels inside a repeated row/tab clone reuse the source panels' keys, so when a snapshot
 * materializes the repeats they must be disambiguated by the enclosing clone's key.
 */
function getEnclosingRepeatCloneKey(vizPanel: VizPanel): string | undefined {
  let current: SceneObject | undefined = vizPanel.parent;
  while (current) {
    const state: { repeatSourceKey?: string; key?: string } = current.state;
    if (state.repeatSourceKey && state.key) {
      return state.key;
    }
    current = current.parent;
  }
  return undefined;
}

/**
 * Element identifier for a viz panel when serializing a snapshot. Repeated panel clones use their own
 * key; panels inside a repeated row/tab clone are additionally prefixed with the enclosing clone's key
 * so each materialized repeat references a unique element.
 */
function getSnapshotElementIdentifierForVizPanel(vizPanel: VizPanel): string {
  const base =
    vizPanel.state.repeatSourceKey && vizPanel.state.key
      ? vizPanel.state.key
      : getElementIdentifierForVizPanel(vizPanel);

  const enclosingCloneKey = getEnclosingRepeatCloneKey(vizPanel);
  return enclosingCloneKey ? `${enclosingCloneKey}-${base}` : base;
}

// Used to find the section owner of a variable (row or tab)
function findSectionOwner(element: SceneObject | undefined): RowItem | TabItem | undefined {
  let current = element;
  while (current) {
    if (current instanceof RowItem || current instanceof TabItem) {
      return current;
    }
    current = current.parent;
  }
  return undefined;
}

export const dashboardSceneGraph = {
  getTimePicker,
  getRefreshPicker,
  getPanelLinks,
  getVizPanels,
  getDataLayers,
  getCursorSync,
  getLayoutManagerFor,
  getNextPanelId,
  getPanelIdGenerator,
  getElementIdentifierForVizPanel,
  getSnapshotElementIdentifierForVizPanel,
  getEnclosingRepeatCloneKey,
  findSectionOwner,
};
