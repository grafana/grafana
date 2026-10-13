import { applyFieldOverrides, LoadingState, type PanelData } from '@grafana/data';
import { config, getTemplateSrv } from '@grafana/runtime';
import { getPanelPluginMetasMapSync, type PanelPluginMetas } from '@grafana/runtime/internal';
import { SceneGridRow, sceneGraph, type SceneDataProvider, type SceneObject, type VizPanel } from '@grafana/scenes';

import { RowItem } from '../scene/layout-rows/RowItem';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { type DashboardSceneLike } from '../scene/types/dashboard';
import { isRepeatCloneOrChildOf } from '../utils/clone';

export interface SourceSection {
  kind: 'tab' | 'row';
  /** The saved title, uninterpolated, so a reference survives variable changes. */
  title: string;
  object: TabItem | RowItem | SceneGridRow;
}

export interface SourcePanel {
  key: string;
  title: string;
  description: string;
  pluginId: string;
  panel: VizPanel;
  /** Tabs and rows the panel sits in, outermost first. */
  sections: SourceSection[];
}

/** Reading plugin metas copies every panel plugin's meta, and a plugin's meta doesn't change while Grafana runs. */
const skipsDataQueryByPluginId = new Map<string, boolean>();

/** Long enough for slow datasources; a panel that still hasn't loaded is reported as not loaded. */
export const LOAD_TIMEOUT_MS = 30_000;
/** Off-screen panels were never measured, and their query resolution depends on a width. */
export const OFF_SCREEN_WIDTH = 1000;

/**
 * Panels whose data can be captured, in layout order. Repeat clones are excluded because their keys are not stable
 * across loads, and panels whose plugin skips data queries because a query runner left by the editor is not data
 * the panel shows.
 */
export function getSourcePanels(dashboard: DashboardSceneLike): SourcePanel[] {
  let metas: PanelPluginMetas | undefined;
  // Panels in other tabs or collapsed rows may not have loaded their plugin yet.
  const skipsDataQuery = (panel: VizPanel) => {
    const plugin = panel.getPlugin();
    if (plugin) {
      return Boolean(plugin.meta.skipDataQuery);
    }
    const { pluginId } = panel.state;
    let skips = skipsDataQueryByPluginId.get(pluginId);
    if (skips === undefined) {
      metas ??= getPanelPluginMetasMapSync();
      const meta = metas[pluginId];
      skips = Boolean(meta?.skipDataQuery);
      if (meta) {
        skipsDataQueryByPluginId.set(pluginId, skips);
      }
    }
    return skips;
  };

  const sources: SourcePanel[] = [];
  for (const panel of dashboard.state.body.getVizPanels()) {
    const { key, $data, pluginId, title, description } = panel.state;
    if (!key || !$data || skipsDataQuery(panel) || isRepeatCloneOrChildOf(panel)) {
      continue;
    }
    sources.push({
      key,
      title: title || key,
      description: description ?? '',
      pluginId,
      panel,
      sections: getSections(panel),
    });
  }
  return sources;
}

function getSections(panel: VizPanel): SourceSection[] {
  const sections: SourceSection[] = [];
  for (let parent: SceneObject | undefined = panel.parent; parent; parent = parent.parent) {
    if (parent instanceof TabItem) {
      sections.unshift({ kind: 'tab', title: parent.state.title ?? '', object: parent });
    } else if (parent instanceof RowItem || parent instanceof SceneGridRow) {
      sections.unshift({ kind: 'row', title: parent.state.title ?? '', object: parent });
    }
  }
  return sections;
}

/** The section's title as the viewer sees it; empty when it has none. */
export function getSectionLabel(section: SourceSection): string {
  return sceneGraph.interpolate(section.object, section.title).trim();
}

/** The data the viewer sees: the outer provider (so transformations apply) with field overrides applied. */
export function getPanelData(panel: VizPanel): PanelData | undefined {
  const data = sceneGraph.getData(panel).state.data;
  return data && applyPanelFieldOverrides(panel, data);
}

/** Display names and units come from the panel's field config, as the viewer sees them. */
export function applyPanelFieldOverrides(panel: VizPanel, data: PanelData): PanelData {
  return {
    ...data,
    series: applyFieldOverrides({
      data: data.series,
      fieldConfig: panel.state.fieldConfig,
      theme: config.theme2,
      replaceVariables: (value, scopedVars, format) => getTemplateSrv().replace(value, scopedVars, format),
    }),
  };
}

function isCurrent(panel: VizPanel, data: PanelData | undefined): boolean {
  const range = sceneGraph.getTimeRange(panel).state.value;
  return Boolean(
    data &&
      (data.state === LoadingState.Done || data.state === LoadingState.Error) &&
      data.timeRange.from.valueOf() === range.from.valueOf() &&
      data.timeRange.to.valueOf() === range.to.valueOf()
  );
}

/**
 * Reads the innermost query runner's private state, so loading neither overrides a measured
 * width nor leaves the in-view bypass on.
 */
function getRunnerState(provider: SceneDataProvider): { bypassed: boolean; measured: boolean } {
  let runner = provider;
  while (runner.state.$data) {
    runner = runner.state.$data;
  }
  return {
    bypassed: '_bypassIsInView' in runner && runner._bypassIsInView === true,
    measured: '_containerWidth' in runner && typeof runner._containerWidth === 'number' && runner._containerWidth > 0,
  };
}

async function loadPanel(panel: VizPanel, signal: AbortSignal): Promise<void> {
  // Activating runs the panel's queries, and an aborted caller no longer wants them.
  if (signal.aborted) {
    return;
  }
  const provider = sceneGraph.getData(panel);
  const { bypassed, measured } = getRunnerState(provider);
  // Activation is reference counted: if the viewer opens the tab meanwhile, the panel stays active.
  const deactivate = panel.activate();
  provider.bypassIsInViewChanged?.(true);
  if (!measured) {
    provider.setContainerWidth?.(OFF_SCREEN_WIDTH);
  }
  try {
    await new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        subscription.unsubscribe();
        signal.removeEventListener('abort', done);
        resolve();
      };
      const timer = setTimeout(done, LOAD_TIMEOUT_MS);
      const subscription = provider.subscribeToState(({ data }) => {
        if (isCurrent(panel, data)) {
          done();
        }
      });
      signal.addEventListener('abort', done);
      if (signal.aborted || isCurrent(panel, provider.state.data)) {
        done();
      }
    });
  } finally {
    provider.bypassIsInViewChanged?.(bypassed);
    deactivate();
  }
}

/**
 * Panels only run queries while rendered, so panels in another tab, a collapsed row, or below the fold may have no
 * data for the current time range. Loads them without rendering.
 */
export async function loadPanels(panels: VizPanel[], signal: AbortSignal): Promise<void> {
  const stale = panels.filter((panel) => !isCurrent(panel, sceneGraph.getData(panel).state.data));
  await Promise.all(stale.map((panel) => loadPanel(panel, signal)));
}
