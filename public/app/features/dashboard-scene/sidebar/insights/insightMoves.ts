import { t } from '@grafana/i18n';
import { type VizPanel } from '@grafana/scenes';
import { TextMode } from 'app/plugins/panel/text/panelcfg.gen';
import { getInsightSessions } from 'app/plugins/panel/text/v2/insight/insightSessions';

import { cleanInsight } from '../../insight-panel/InsightQuestionFields';
import { TEXT_PANEL_PLUGIN_ID } from '../../insight-panel/applyInsightToPanel';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { getDefaultVizPanel } from '../../utils/utils';
import { DashboardBatchEditActionEndEvent, DashboardBatchEditActionStartEvent } from '../events';

import { getInsightPanelOptions } from './insightPanels';
import { addInsightQuestion, deleteInsightQuestion } from './insightsEditActions';
import { type InsightsDashboard, readInsightQuestions } from './insightsStorage';
import { revealInsightSourcePanel } from './navigation';

/** One undo step, so undoing a move restores the question and removes the panel together. */
function inBatch(dashboard: InsightsDashboard, description: string, perform: () => void) {
  dashboard.publishEvent(new DashboardBatchEditActionStartEvent({ source: dashboard, description }), true);
  try {
    perform();
  } finally {
    dashboard.publishEvent(new DashboardBatchEditActionEndEvent(), true);
  }
}

/** Puts a saved question on the canvas as an Insight panel, keeping its answer. */
export async function moveInsightQuestionToPanel(dashboard: InsightsDashboard, id: string): Promise<void> {
  const question = readInsightQuestions(dashboard).questions.find((candidate) => candidate.id === id);
  if (!question) {
    return;
  }
  const panel = await getDefaultVizPanel();
  panel.setState({
    title: t('dashboard.insight-panel.default-title', 'Insights'),
    pluginId: TEXT_PANEL_PLUGIN_ID,
    options: { mode: TextMode.Insight, insight: cleanInsight(question) },
    // Insight mode reads the source panels' data, never its own.
    $data: undefined,
  });

  inBatch(dashboard, t('dashboard.insights.edit-action.move-to-panel', 'Move insight question to dashboard'), () => {
    dashboard.state.body.addPanel(panel);
    // Re-read: adding the panel may have entered edit mode or otherwise changed the saved questions.
    deleteInsightQuestion(dashboard, readInsightQuestions(dashboard).questions, id);
  });

  if (panel.state.key) {
    getInsightSessions(dashboard).copy(id, panel.state.key);
  }
  revealInsightSourcePanel(panel);
}

/** Turns an Insight panel into a saved question in the sidebar, keeping its answer. */
export function moveInsightPanelToQuestion(dashboard: InsightsDashboard, panel: VizPanel): void {
  const key = panel.state.key;
  const layout = dashboardSceneGraph.getLayoutManagerFor(panel);
  if (!key || !layout.removePanel) {
    return;
  }
  let id = '';
  inBatch(dashboard, t('dashboard.insights.edit-action.move-to-pane', 'Move Insight panel to saved questions'), () => {
    id = addInsightQuestion(
      dashboard,
      readInsightQuestions(dashboard).questions,
      cleanInsight(getInsightPanelOptions(panel))
    );
    layout.removePanel?.(panel);
  });
  getInsightSessions(dashboard).copy(key, id);
}
