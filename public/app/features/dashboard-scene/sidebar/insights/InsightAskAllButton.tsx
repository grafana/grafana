import { useSyncExternalStore } from 'react';

import { t } from '@grafana/i18n';
import { Button } from '@grafana/ui';
import { getInsightSessions, type InsightAskQuestion } from 'app/plugins/panel/text/v2/insight/insightSessions';

import { type DashboardSceneLike } from '../../scene/types/dashboard';

interface Props {
  dashboard: DashboardSceneLike;
  items: Array<{ id: string; question: InsightAskQuestion }>;
}

/** Asks every insight on the dashboard, a few at a time, so a viewer can read them all at once. */
export function InsightAskAllButton({ dashboard, items }: Props) {
  const sessions = getInsightSessions(dashboard);
  const askingAll = useSyncExternalStore(sessions.subscribe, sessions.isAskingAll);

  if (askingAll) {
    return (
      <Button size="sm" variant="secondary" fill="outline" icon="spinner" onClick={() => sessions.cancelAll()}>
        {t('dashboard.insights.pane.stop-asking', 'Stop asking')}
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="secondary"
      icon="ai-sparkle"
      tooltip={t('dashboard.insights.pane.ask-all-tooltip', 'Ask Assistant every question on this dashboard')}
      onClick={() => sessions.askAll(items)}
    >
      {t('dashboard.insights.pane.ask-all', 'Ask all')}
    </Button>
  );
}
