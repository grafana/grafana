import { type VizPanel } from '@grafana/scenes';
import { type InsightOptions, TextMode } from 'app/plugins/panel/text/panelcfg.gen';

import { TEXT_PANEL_PLUGIN_ID } from '../../insight-panel/applyInsightToPanel';
import { type DashboardSceneLike } from '../../scene/types/dashboard';
import { isRepeatCloneOrChildOf } from '../../utils/clone';

/** A Text panel in Insight mode, which answers one question on the dashboard canvas. */
export function isInsightPanel(panel: VizPanel): boolean {
  const { pluginId, options } = panel.state;
  return pluginId === TEXT_PANEL_PLUGIN_ID && 'mode' in options && options.mode === TextMode.Insight;
}

/** Repeat clones are excluded so a repeated Insight panel is listed once. */
export function getInsightPanels(dashboard: DashboardSceneLike): VizPanel[] {
  return dashboard.state.body
    .getVizPanels()
    .filter((panel) => Boolean(panel.state.key) && isInsightPanel(panel) && !isRepeatCloneOrChildOf(panel));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function getInsightPanelOptions(panel: VizPanel): InsightOptions {
  const { options } = panel.state;
  const insight = 'insight' in options && typeof options.insight === 'object' && options.insight ? options.insight : {};
  return {
    question: 'question' in insight && typeof insight.question === 'string' ? insight.question : '',
    sourcePanelKeys:
      'sourcePanelKeys' in insight && isStringArray(insight.sourcePanelKeys) ? insight.sourcePanelKeys : [],
    followUps: 'followUps' in insight && isStringArray(insight.followUps) ? insight.followUps : [],
    compareWithPreviousPeriod:
      'compareWithPreviousPeriod' in insight && insight.compareWithPreviousPeriod === true ? true : undefined,
    breakdownVariable:
      'breakdownVariable' in insight && typeof insight.breakdownVariable === 'string' && insight.breakdownVariable
        ? insight.breakdownVariable
        : undefined,
  };
}
