import memoize from 'micro-memoize';

import { formattedValueToString, getValueFormat } from '@grafana/data';
import { t } from '@grafana/i18n';

import { LOGS_DRILLDOWN_APP_ID } from './appPluginIds';
import { drilldownActiveCta } from './pluginPages';
import { datasourceFact } from './probeUtils';
import { CLOUD_UTILITY_LOKI_DATASOURCE_UIDS, labelRecencyProbe, probeFound } from './solutionDataProbes';
import { solutionOffer } from './solutionOffer';
import { detectSignal } from './solutionState';
import { fetchLogsActivity } from './telemetryData';
import { getTelemetrySetupCta, getTelemetrySetupLearnMore } from './telemetrySetup';
import { type Solution } from './types';

// Loki label APIs use nanoseconds. This matches LokiDatasource, including its accepted precision loss.
const lokiHasRecentLabels = labelRecencyProbe('labels', (ms) => ms * 1e6);

export function logsSolution(): Solution {
  const detect = memoize(() =>
    detectSignal(() => probeFound('loki', lokiHasRecentLabels, CLOUD_UTILITY_LOKI_DATASOURCE_UIDS))
  );
  const datasource = async () => (await detect()).datasource;

  const activity = datasourceFact(datasource, fetchLogsActivity);

  const signal = async () => (await detect()).status;

  return {
    id: 'logs',
    icon: 'gf-logs',
    title: t('home.solutions.logs.title', 'Logs'),
    signal,
    datasource,
    needsAttention: async () => false,
    offer: solutionOffer(signal, {
      appId: LOGS_DRILLDOWN_APP_ID,
      description: t(
        'home.solutions.logs.description',
        'Aggregate and search logs from your applications and infrastructure.'
      ),
      setupHint: t('home.solutions.logs.setup-hint', 'connect a logs source'),
      setupCta: async (capabilities) => getTelemetrySetupCta('logs', capabilities),
      getLearnMore: (capabilities) => getTelemetrySetupLearnMore('logs', capabilities),
    }),
    alert: async () => null,
    refinedStats: async () => null,
    stats: async () => {
      const logs = await activity();
      if (logs?.bytes == null) {
        return null;
      }
      return {
        primary: formattedValueToString(getValueFormat('decbytes')(logs.bytes)),
        secondary:
          logs.sources != null
            ? t('home.solutions.logs.stats-sources', '', {
                count: logs.sources,
                defaultValue_one: 'ingested · 7d · ~{{count}} source',
                defaultValue_other: 'ingested · 7d · ~{{count}} sources',
              })
            : t('home.solutions.logs.stats', 'ingested · 7d'),
      };
    },
    sparkline: async () => {
      const logs = await activity();
      return logs?.series
        ? { series: logs.series, caption: t('home.solutions.logs.volume', 'Ingest volume · last 24h') }
        : null;
    },
    cta: async () => {
      const ds = await datasource();
      if (!ds) {
        return null;
      }
      return drilldownActiveCta(
        ds,
        LOGS_DRILLDOWN_APP_ID,
        'Logs Drilldown',
        `/a/${LOGS_DRILLDOWN_APP_ID}/explore?var-ds=${encodeURIComponent(ds.uid)}`
      );
    },
  };
}
