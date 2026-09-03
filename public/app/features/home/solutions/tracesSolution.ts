import memoize from 'micro-memoize';

import { formattedValueToString, getValueFormat } from '@grafana/data';
import { t } from '@grafana/i18n';

import { HOSTED_TRACES_APP_ID } from './appPluginIds';
import { drilldownActiveCta } from './pluginPages';
import { datasourceFact } from './probeUtils';
import { probeFound, tempoHasTraces } from './solutionDataProbes';
import { solutionOffer } from './solutionOffer';
import { detectSignal } from './solutionState';
import { fetchTracesActivity, fetchTracesServices } from './telemetryData';
import { getTelemetrySetupCta, getTelemetrySetupLearnMore } from './telemetrySetup';
import { type Solution } from './types';

const formatUsageNumber = getValueFormat('short');

function buildTracesStats(spans: number | null, services: number | null, lookbackHours: number) {
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
            hours: lookbackHours,
            defaultValue_one: 'traced · {{hours}}h · {{count}} service',
            defaultValue_other: 'traced · {{hours}}h · {{count}} services',
          })
        : t('home.solutions.traces.stats', 'traced · {{hours}}h', { hours: lookbackHours }),
  };
}

export function tracesSolution(): Solution {
  const detect = memoize(() => detectSignal(() => probeFound('tempo', tempoHasTraces)));
  const datasource = async () => (await detect()).datasource;

  // retryOnError: a timed-out or failed query must not cache its rejection for the whole visit —
  // the abandoned request still warms Tempo's query cache, so a later reader's retry succeeds.
  const activity = datasourceFact(datasource, fetchTracesActivity, { retryOnError: true });
  const services = datasourceFact(datasource, fetchTracesServices, { retryOnError: true });

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
    stats: async () => {
      const traces = await activity();
      return traces ? buildTracesStats(traces.spans, null, traces.lookbackHours) : null;
    },
    refinedStats: async () => {
      const [spans, serviceCount] = await Promise.all([activity(), services().catch(() => null)]);
      return spans && serviceCount != null ? buildTracesStats(spans.spans, serviceCount, spans.lookbackHours) : null;
    },
    sparkline: async () => {
      const traces = await activity();
      return traces?.series
        ? {
            series: traces.series,
            caption: t('home.solutions.traces.throughput', 'Span throughput · last {{hours}}h', {
              hours: traces.lookbackHours,
            }),
          }
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
