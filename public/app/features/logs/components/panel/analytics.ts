import { CoreApp, LogRowModel } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';

import { identifyOTelLanguages } from '../otel/formats';

export const reportInteractionOnce = (interactionName: string, properties?: Record<string, unknown>) => {
  const key = `logs.interactions.${interactionName}`;
  if (sessionStorage.getItem(key)) {
    return;
  }
  sessionStorage.setItem(key, '1');
  reportInteraction(interactionName, properties);
};

export function collectInsights(logs: LogRowModel[], app: CoreApp, properties?: Record<string, unknown>) {
  reportInteractionOnce(`logs_log_list_${app}_logs_displayed`, {
    ...properties,
    otelLanguage: identifyOTelLanguages(logs).join(', '),
    ansi: logs.some((logs) => logs.hasAnsi),
    unescaped: logs.some((logs) => logs.hasUnescapedContent),
    dsType: logs[0]?.datasourceType ?? '',
  });
}
