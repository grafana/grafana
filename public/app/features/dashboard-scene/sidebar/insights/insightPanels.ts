import { type VizPanel } from '@grafana/scenes';

import { type DashboardSceneLike } from '../../scene/types/dashboard';
import { isRepeatCloneOrChildOf } from '../../utils/clone';

/** The Assistant app's Insight panel, which answers one question on the dashboard canvas. */
export const INSIGHT_PANEL_PLUGIN_ID = 'grafana-assistant-insight-panel';

/** Repeat clones are excluded so a repeated Insight panel is listed once. */
export function getInsightPanels(dashboard: DashboardSceneLike): VizPanel[] {
  return dashboard.state.body
    .getVizPanels()
    .filter((panel) => panel.state.pluginId === INSIGHT_PANEL_PLUGIN_ID && !isRepeatCloneOrChildOf(panel));
}

export function getInsightPanelQuestion(panel: VizPanel): string {
  const options = panel.state.options;
  const question = 'question' in options && typeof options.question === 'string' ? options.question.trim() : '';
  return question || panel.state.title.trim();
}
