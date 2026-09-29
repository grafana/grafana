import { t } from '@grafana/i18n';
import { type VizPanel } from '@grafana/scenes';
import { type InsightOptions, TextMode } from 'app/plugins/panel/text/panelcfg.gen';

import { type DashboardScene } from '../scene/DashboardScene';

export const TEXT_PANEL_PLUGIN_ID = 'text';

/**
 * Turns an unconfigured panel into a Text panel in insight mode, carrying the question, sources,
 * and follow-ups the author set. Requires the `grafana.newTextPanel` flag, which is what puts
 * insight mode on the Text panel at all.
 */
export async function applyInsightToPanel(
  dashboard: DashboardScene,
  panel: VizPanel,
  insight: InsightOptions
): Promise<void> {
  await dashboard.changePanelPlugin(panel, TEXT_PANEL_PLUGIN_ID, {
    mode: TextMode.Insight,
    insight,
  });

  dashboard.updatePanelTitle(panel, t('dashboard.insight-panel.default-title', 'Insights'));

  // Insight mode reads the source panels' data, never its own, so it needs no query runner.
  // Opening the panel editor adds one back, which is what switching to another mode needs.
  if (panel.state.$data) {
    panel.setState({ $data: undefined });
  }
}
