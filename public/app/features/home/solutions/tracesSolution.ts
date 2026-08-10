import memoize from 'micro-memoize';

import { formattedValueToString, getValueFormat } from '@grafana/data';
import { t } from '@grafana/i18n';

import { HOSTED_TRACES_APP_ID } from './appPluginIds';
import { type Solution } from './model';
import { drilldownActiveCta } from './pluginPages';
import { probeFound, tempoHasTraces } from './solutionDataProbes';
import { solutionOffer } from './solutionOffer';
import { detectSignal } from './solutionState';
import { fetchTracesActivity, fetchTracesServices } from './telemetryData';
import { getTelemetrySetupCta, getTelemetrySetupLearnMore } from './telemetrySetup';

const formatUsageNumber = getValueFormat('short');

function buildTracesStats(spans: number | null, services: number | null) {
  if (spans == null) {
    return null;
  }
  return {
    primary: t('home.solutions.traces.spans', '', {
      count: Math.ceil(spans),
      value: formattedValueToString(formatUsageNumber(Math.ceil(spans))),
      defaultValue_one: '{{value}} span',
      defaultValue_other: '{{value}} spans',
    }),
    secondary:
      services != null
        ? t('home.solutions.traces.stats-services', '', {
            count: services,
            defaultValue_one: 'traced · 24h · {{count}} service',
            defaultValue_other: 'traced · 24h · {{count}} services',
          })
        : t('home.solutions.traces.stats', 'traced · 24h'),
  };
}

export function tracesSolution(): Solution {
  const detect = memoize(() => detectSignal(() => probeFound('tempo', tempoHasTraces)));
  const datasource = async () => (await detect()).datasource;

  const activity = memoize(async () => {
    const ds = await datasource();
    return ds ? fetchTracesActivity(ds) : null;
  });
  const services = memoize(async () => {
    const ds = await datasource();
    return ds ? fetchTracesServices(ds) : null;
  });

  const signal = async () => (await detect()).status;

  return {
    id: 'traces',
    icon: 'gf-traces',
    title: t('home.solutions.traces.title', 'Traces'),
    signal,
    datasource,
    needsAttention: async () => false,
    offer: solutionOffer(signal, {
      appId: HOSTED_TRACES_APP_ID,
      description: t(
        'home.solutions.traces.description',
        'See how requests flow across services and where they slow down.'
      ),
      setupHint: t('home.solutions.traces.setup-hint', 'requires instrumentation'),
      setupCta: async (capabilities) => getTelemetrySetupCta('traces', capabilities),
      getLearnMore: (capabilities) => getTelemetrySetupLearnMore('traces', capabilities),
    }),
    alert: async () => null,
    // Render the span total immediately; the slower service count only refines the secondary line.
    stats: async () => buildTracesStats((await activity())?.spans ?? null, null),
    refinedStats: async () => {
      const [spans, serviceCount] = await Promise.all([activity(), services().catch(() => null)]);
      return serviceCount != null ? buildTracesStats(spans?.spans ?? null, serviceCount) : null;
    },
    sparkline: async () => {
      const traces = await activity();
      return traces?.series
        ? { series: traces.series, caption: t('home.solutions.traces.throughput', 'Span throughput · last 24h') }
        : null;
    },
    cta: async () => {
      const ds = await datasource();
      if (!ds) {
        return null;
      }
      return drilldownActiveCta(
        ds,
        HOSTED_TRACES_APP_ID,
        'Traces Drilldown',
        `/a/${HOSTED_TRACES_APP_ID}/explore?var-ds=${encodeURIComponent(ds.uid)}`
      );
    },
  };
}
