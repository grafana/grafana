import { applyFieldOverrides, type PanelData } from '@grafana/data';
import { config, getTemplateSrv } from '@grafana/runtime';
import { sceneGraph, type VizPanel } from '@grafana/scenes';

import { type DashboardSceneLike } from '../../scene/types/dashboard';
import { isRepeatCloneOrChildOf } from '../../utils/clone';

export interface InsightSourcePanel {
  key: string;
  title: string;
  description: string;
  panel: VizPanel;
}

/** Repeat clones are excluded because their keys are not stable across loads. */
export function getInsightSourcePanels(dashboard: DashboardSceneLike): InsightSourcePanel[] {
  const sources: InsightSourcePanel[] = [];
  for (const panel of dashboard.state.body.getVizPanels()) {
    const key = panel.state.key;
    if (!key || !panel.state.$data || isRepeatCloneOrChildOf(panel)) {
      continue;
    }
    sources.push({ key, title: panel.state.title || key, description: panel.state.description ?? '', panel });
  }
  return sources;
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
