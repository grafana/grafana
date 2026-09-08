import memoize from 'micro-memoize';

import { formattedValueToString, getValueFormat, locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';

import {
  fetchAppObservabilityRequestSeries,
  fetchAppObservabilityStats,
  probeSpanMetrics,
} from './appObservabilityData';
import { APP_OBSERVABILITY_APP_ID } from './appPluginIds';
import { accessibleAppPage, drilldownActiveCta } from './pluginPages';
import { datasourceFact } from './probeUtils';
import { solutionOffer } from './solutionOffer';
import { detectSignal } from './solutionState';
import { type Solution } from './types';

const formatUsageNumber = getValueFormat('short');

export function appObservabilitySolution(): Solution {
  const detect = memoize(() => detectSignal(probeSpanMetrics));
  const datasource = async () => (await detect()).datasource;

  const stats = datasourceFact(datasource, fetchAppObservabilityStats);
  const requestSeries = datasourceFact(datasource, fetchAppObservabilityRequestSeries);

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
        // /landing is the app's onboarding page; it only explains external instrumentation,
        // so page access is the whole permission check.
        const page = await accessibleAppPage(APP_OBSERVABILITY_APP_ID, '/landing');
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
      if (!usage?.services || usage.services <= 0) {
        return null;
      }
      const serviceCount = Math.ceil(usage.services);
      return {
        primary: t('home.solutions.app-observability.services', '', {
          count: serviceCount,
          value: formattedValueToString(formatUsageNumber(serviceCount)),
          defaultValue_one: '{{value}} service',
          defaultValue_other: '{{value}} services',
        }),
        secondary:
          usage.errorRatio != null
            ? t('home.solutions.app-observability.stats', '{{percent}}% errors · 24h', {
                percent: parseFloat((usage.errorRatio * 100).toFixed(1)),
              })
            : undefined,
      };
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
