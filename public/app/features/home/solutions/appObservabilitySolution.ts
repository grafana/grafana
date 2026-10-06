import memoize from 'micro-memoize';

import { locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';

import {
  fetchAppObservabilityRequestSeries,
  fetchAppObservabilityStats,
  probeSpanMetrics,
} from './appObservabilityData';
import { APP_OBSERVABILITY_APP_ID, APP_OBSERVABILITY_SETUP_PATH } from './appPluginIds';
import { accessibleAppPage, drilldownActiveCta } from './pluginPages';
import { datasourceFact } from './probeUtils';
import { solutionOffer } from './solutionOffer';
import { detectSignal } from './solutionState';
import { countRatioStats } from './solutionStats';
import { type Solution } from './types';

export function appObservabilitySolution(): Solution {
  const detect = memoize(() => detectSignal(probeSpanMetrics));
  const datasource = async () => (await detect()).datasource;

  // retryOnError: a timed-out query must not cache its rejection for the whole visit — the
  // abandoned request still warms the query cache, so a later reader's retry can succeed.
  const stats = datasourceFact(datasource, fetchAppObservabilityStats, { retryOnError: true });
  const requestSeries = datasourceFact(datasource, fetchAppObservabilityRequestSeries, { retryOnError: true });

  const signal = async () => (await detect()).status;

  return {
    id: 'app-observability',
    icon: 'application-observability',
    title: t('home.solutions.app-observability.title', 'Application Observability'),
    signal,
    datasource,
    // No attention state: the growth matrix defines recommendations only, no health threshold.
    needsAttention: async () => false,
    offer: solutionOffer(signal, {
      appId: APP_OBSERVABILITY_APP_ID,
      description: t(
        'home.solutions.app-observability.description',
        'Turn OpenTelemetry data into RED metrics, service maps, and correlated traces.'
      ),
      setupHint: t('home.solutions.app-observability.setup-hint', 'requires instrumentation'),
      setupCta: async () => {
        const page = await accessibleAppPage(APP_OBSERVABILITY_APP_ID, APP_OBSERVABILITY_SETUP_PATH);
        return page
          ? {
              label: t('home.solutions.app-observability.setup', 'Set up Application Observability'),
              href: locationUtil.assureBaseUrl(page),
              action: 'setup',
            }
          : null;
      },
      getLearnMore: () => ({
        href: 'https://grafana.com/docs/grafana-cloud/observe-and-act/monitor-applications/application-observability/',
      }),
    }),
    alert: async () => null,
    stats: async () => {
      const usage = await stats();
      return countRatioStats(
        usage?.services,
        usage?.errorRatio,
        (count, value) =>
          t('home.solutions.app-observability.services', '', {
            count,
            value,
            defaultValue_one: '{{value}} service',
            defaultValue_other: '{{value}} services',
          }),
        (percent) => t('home.solutions.app-observability.stats', '{{percent}} errors · 1h', { percent })
      );
    },
    refinedStats: async () => null,
    sparkline: async () => {
      const series = await requestSeries();
      return series
        ? { series, caption: t('home.solutions.app-observability.request-trend', 'Request rate · last 24h') }
        : null;
    },
    cta: async () => {
      const ds = await datasource();
      if (!ds) {
        return null;
      }
      return drilldownActiveCta(
        ds,
        APP_OBSERVABILITY_APP_ID,
        'Application Observability',
        `/a/${APP_OBSERVABILITY_APP_ID}/services`
      );
    },
  };
}
