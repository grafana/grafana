import { VizPanel, sceneGraph, behaviors, type SceneObject, SceneGridRow } from '@grafana/scenes';
import { type Panel } from '@grafana/schema';

import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { type DashboardScene } from '../scene/DashboardScene';
import { PanelIntentChips } from '../scene/PanelIntentChips';
import { VizPanelLinks } from '../scene/PanelLinks';
import { RowItem } from '../scene/layout-rows/RowItem';
import { TabItem } from '../scene/layout-tabs/TabItem';

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

function getPanelIntentChips(panel: VizPanel): PanelIntentChips | null {
  if (panel.state.titleItems && Array.isArray(panel.state.titleItems)) {
    const chips = panel.state.titleItems.find((item) => item instanceof PanelIntentChips);
    return chips ?? null;
  }
  return null;
}

function getVizPanels(scene: DashboardScene): VizPanel[] {
  return scene.state.body.getVizPanels();
}

type PanelIntent = NonNullable<Panel['intent']>;
type FailureMode = NonNullable<PanelIntent['failureModes']>[number];
type Runbook = NonNullable<PanelIntent['runbooks']>[number];

/**
 * A failure mode / runbook aggregated up from one or more panels, carrying the
 * titles of the panels it was sourced from so the dashboard summary bar can
 * attribute it in a tooltip.
 */
export interface AggregatedFailureMode extends FailureMode {
  panels: string[];
}
export interface AggregatedRunbook extends Runbook {
  panels: string[];
}
export interface AggregatedPanelIntent {
  failureModes: AggregatedFailureMode[];
  runbooks: AggregatedRunbook[];
}

/**
 * Collects failure modes and runbooks from every panel's intent into a single
 * deduplicated list for the dashboard-level summary bar. Failure modes dedupe
 * by `tag`, runbooks by `url || title`. The dashboard header is a read-only
 * summary of the operational knowledge declared on the panels below it; owner
 * and purpose live on the dashboard-level intent block, not here.
 */
function getAggregatedPanelIntent(scene: DashboardScene): AggregatedPanelIntent {
  const failureModesByTag = new Map<string, AggregatedFailureMode>();
  const runbooksByKey = new Map<string, AggregatedRunbook>();

  for (const panel of getVizPanels(scene)) {
    const intent = getPanelIntentChips(panel)?.state.intent;
    if (!intent) {
      continue;
    }
    const panelTitle = panel.state.title || getPanelIdForVizPanel(panel).toString();

    const failureModes = Array.isArray(intent.failureModes) ? intent.failureModes : [];
    for (const fm of failureModes) {
      if (!fm.tag) {
        continue;
      }
      const existing = failureModesByTag.get(fm.tag);
      if (existing) {
        if (!existing.panels.includes(panelTitle)) {
          existing.panels.push(panelTitle);
        }
        // Keep the first non-empty description we encounter.
        if (!existing.description && fm.description) {
          existing.description = fm.description;
        }
      } else {
        failureModesByTag.set(fm.tag, { ...fm, panels: [panelTitle] });
      }
    }

    const runbooks = Array.isArray(intent.runbooks) ? intent.runbooks : [];
    for (const rb of runbooks) {
      const key = rb.url || rb.title;
      if (!key) {
        continue;
      }
      const existing = runbooksByKey.get(key);
      if (existing) {
        if (!existing.panels.includes(panelTitle)) {
          existing.panels.push(panelTitle);
        }
      } else {
        runbooksByKey.set(key, { ...rb, panels: [panelTitle] });
      }
    }
  }

  return {
    failureModes: Array.from(failureModesByTag.values()),
    runbooks: Array.from(runbooksByKey.values()),
  };
}

/** A panel currently matching one or more of its declared failure modes. */
export interface AnomalousPanel {
  title: string;
  tags: string[];
}

/**
 * Collects panels that are actively matching a declared failure mode (Phase
 * F-lite). A panel is anomalous when its `PanelIntentChips` has an `activeMatch`
 * (set while it breaches its alert threshold and declares failure modes). Used
 * by the dashboard summary bar to render a "needs attention" health strip.
 */
function getAnomalousPanels(scene: DashboardScene): AnomalousPanel[] {
  const anomalous: AnomalousPanel[] = [];
  for (const panel of getVizPanels(scene)) {
    const chips = getPanelIntentChips(panel);
    if (!chips?.state.activeMatch) {
      continue;
    }
    const failureModes = Array.isArray(chips.state.intent.failureModes) ? chips.state.intent.failureModes : [];
    anomalous.push({
      title: panel.state.title || getPanelIdForVizPanel(panel).toString(),
      tags: failureModes.map((fm) => fm.tag).filter(Boolean),
    });
  }
  return anomalous;
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
export function getPanelIdGenerator(scene: SceneObject): PanelIdGenerator {
  let id = getNextPanelId(scene);
  return () => id++;
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
  getPanelIntentChips,
  getAggregatedPanelIntent,
  getAnomalousPanels,
  getVizPanels,
  getDataLayers,
  getCursorSync,
  getLayoutManagerFor,
  getNextPanelId,
  getPanelIdGenerator,
  getElementIdentifierForVizPanel,
  findSectionOwner,
};
