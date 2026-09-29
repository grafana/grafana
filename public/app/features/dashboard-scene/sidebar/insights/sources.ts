import { applyFieldOverrides, LoadingState, type PanelData } from '@grafana/data';
import { config, getTemplateSrv } from '@grafana/runtime';
import { SceneGridRow, sceneGraph, type SceneDataProvider, type SceneObject, type VizPanel } from '@grafana/scenes';

import { RowItem } from '../../scene/layout-rows/RowItem';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { type DashboardSceneLike } from '../../scene/types/dashboard';
import { isRepeatCloneOrChildOf } from '../../utils/clone';

import { INSIGHT_PANEL_PLUGIN_ID } from './insightPanels';

export interface InsightSourceSection {
  kind: 'tab' | 'row';
  /** The saved title, uninterpolated, so a selection survives variable changes. */
  title: string;
  object: TabItem | RowItem | SceneGridRow;
}

export interface InsightSourcePanel {
  key: string;
  title: string;
  description: string;
  panel: VizPanel;
  /** Tabs and rows the panel sits in, outermost first. */
  sections: InsightSourceSection[];
}

/** Long enough for slow datasources; the viewer can still read the error and ask again. */
const LOAD_TIMEOUT_MS = 30_000;
/** Off-screen panels were never measured, and their query resolution depends on a width. */
const OFF_SCREEN_WIDTH = 1000;

/** Repeat clones are excluded because their keys are not stable across loads. */
export function getInsightSourcePanels(dashboard: DashboardSceneLike): InsightSourcePanel[] {
  const sources: InsightSourcePanel[] = [];
  for (const panel of dashboard.state.body.getVizPanels()) {
    const key = panel.state.key;
    if (
      !key ||
      !panel.state.$data ||
      panel.state.pluginId === INSIGHT_PANEL_PLUGIN_ID ||
      isRepeatCloneOrChildOf(panel)
    ) {
      continue;
    }
    sources.push({
      key,
      title: panel.state.title || key,
      description: panel.state.description ?? '',
      panel,
      sections: getSections(panel),
    });
  }
  return sources;
}

function getSections(panel: VizPanel): InsightSourceSection[] {
  const sections: InsightSourceSection[] = [];
  for (let parent: SceneObject | undefined = panel.parent; parent; parent = parent.parent) {
    if (parent instanceof TabItem) {
      sections.unshift({ kind: 'tab', title: parent.state.title ?? '', object: parent });
    } else if (parent instanceof RowItem || parent instanceof SceneGridRow) {
      sections.unshift({ kind: 'row', title: parent.state.title ?? '', object: parent });
    }
  }
  return sections;
}

/** The data the viewer sees: the outer provider (so transformations apply) with field overrides applied. */
export function getInsightSourceData(panel: VizPanel): PanelData | undefined {
  const data = sceneGraph.getData(panel).state.data;
  if (!data) {
    return undefined;
  }
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
 * Panels only run queries while rendered, so sources in another tab, a collapsed row, or below the
 * fold may have no data for the current time range. Loads them without rendering. Returns undefined
 * when every source is already current.
 */
export function loadInsightSources(sources: InsightSourcePanel[], signal: AbortSignal): Promise<void> | undefined {
  const panels = sources
    .map((source) => source.panel)
    .filter((panel) => !isCurrent(panel, sceneGraph.getData(panel).state.data));
  if (!panels.length) {
    return undefined;
  }
  return Promise.all(panels.map((panel) => loadPanel(panel, signal))).then(() => undefined);
}
