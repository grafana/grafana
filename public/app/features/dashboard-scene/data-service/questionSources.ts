import { type Question } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { getVizPanelKeyForPanelId } from '../utils/utils-panels';

/**
 * References to the panels a question is answered from, as the dashboard data API resolves them: the panels the
 * author picked, or `defaultRef`, every panel in the dashboard, row, or tab the question is saved on.
 */
export function getQuestionSourceRefs(question: Question, defaultRef: string): string[] {
  const picked = (question.sources ?? []).map((source) => getVizPanelKeyForPanelId(source.panelId));
  return picked.length ? picked : [defaultRef];
}
