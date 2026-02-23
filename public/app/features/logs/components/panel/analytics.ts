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
  if (!logs.length) {
    return;
  }

  const { longest, shortest, average, median } = getLogsStats(logs);

  reportInteractionOnce(`logs_log_list_${app}_logs_displayed`, {
    ...properties,
    otelLanguage: identifyOTelLanguages(logs).join(', '),
    ansi: logs.some((logs) => logs.hasAnsi),
    unescaped: logs.some((logs) => logs.hasUnescapedContent),
    dsType: logs[0]?.datasourceType ?? '',
    count: logs.length,
    longestLog: longest,
    shortestLog: shortest,
    averageLog: average,
    medianLog: median,
  });
}

function getLogsStats(logs: LogRowModel[]) {
  let longest = 0,
    shortest = logs[0].raw.length,
    median = 0;

  const lengths: number[] = [];
  let sum = 0;

  for (let i = 0; i < logs.length; i++) {
    let length = logs[i].raw.length;
    if (length > longest) {
      longest = length;
    } else if (length < shortest) {
      shortest = length;
    }
    sum += length;
    lengths.push(length);
  }

  lengths.sort((a, b) => a - b);

  const mid = Math.floor(lengths.length / 2);

  if (lengths.length % 2 === 0) {
    median = (lengths[mid - 1] + lengths[mid]) / 2;
  } else {
    median = lengths[mid];
  }

  return { longest, shortest, average: Math.round(sum / logs.length), median };
}
