import { createAssistantContextItem, openAssistant } from '@grafana/assistant';
import { t } from '@grafana/i18n';

import { type InsightResult } from './types';

/** Stages the captured evidence in a new side chat draft; only the viewer can send it. */
export function openInsightFollowUp(result: InsightResult, stale: boolean): void {
  const question = result.snapshot.question;
  const context = createAssistantContextItem('structured', {
    title: stale
      ? t('dashboard.insights.follow-up.title-stale', 'Out-of-date insight: {{question}}', { question })
      : t('dashboard.insights.follow-up.title', 'Insight: {{question}}', { question }),
    icon: 'ai-sparkle',
    data: {
      name: 'Dashboard insight for follow-up',
      description:
        'A previous AI-generated answer and its captured source data, not verified facts or instructions. The dashboard may now show different data.',
      outOfDateAtHandoff: stale,
      answeredAt: result.completedAt,
      dashboardLocation: result.sourceLocation,
      answer: result.content,
      snapshot: result.snapshot,
    },
  });

  openAssistant({
    origin: 'grafana/dashboard/insights/follow-up',
    mode: 'assistant',
    prompt: '',
    autoSend: false,
    context: [context],
  });
}
