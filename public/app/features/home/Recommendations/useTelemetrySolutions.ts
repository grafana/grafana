import { useAsync } from 'react-use';

import { canAccessPluginPage, usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';

import { HOSTED_TRACES_APP_ID, LOGS_DRILLDOWN_APP_ID, METRICS_DRILLDOWN_APP_ID } from './appPluginIds';
import { buildLogsItem, buildMetricsItem, buildTracesItem } from './buildTelemetryItems';
import { useSolutionState } from './solutionState';
import { fetchLogsActivity, fetchMetricsActivity, fetchTracesActivity, fetchTracesServices } from './telemetryData';
import { type ExistingItem, type ExistingSolutionProviderResult } from './types';

export interface TelemetrySolutions {
  metrics: ExistingSolutionProviderResult;
  logs: ExistingSolutionProviderResult;
  traces: ExistingSolutionProviderResult;
}

// Shared settle gate for the three providers. Error fails closed (settled no-data — the types.ts
// provider contract). Loading or an undefined value reads as loading: on the render where a
// signal flips active, useAsync still exposes the disabled run's settled `undefined` (its effect
// re-runs only after paint) — that frame must not paint as settled empty (same guard as
// useKubernetesSolution). Results are not keyed to the datasource: solution resolution is
// one-shot per mount (undefined → at most one datasource, never A → B), so a retained value
// cannot belong to a different datasource — an in-place datasource swap would need uid-keyed
// results first. `build` returns null when the activity has nothing to carry a card.
function toProviderResult<T>(
  state: { loading: boolean; error?: Error; value?: { activity: T } },
  build: (activity: T) => ExistingItem | null
): ExistingSolutionProviderResult {
  if (state.error) {
    return { loading: false, item: null };
  }
  if (state.loading || !state.value) {
    return { loading: true, item: null };
  }
  return { loading: false, item: build(state.value.activity) };
}

/**
 * Whether a drilldown app is installed, enabled, and its root page is accessible — bootdata
 * membership alone lists installed-but-disabled apps (config.apps carries no enabled state),
 * which would turn the CTA into a dead /a/<id> link instead of the working Explore fallback.
 */
function useDrilldownAvailable(appId: string): boolean {
  const { installed, settings } = usePluginBridge(appId);
  return !!installed && !!settings && canAccessPluginPage(settings, `/a/${appId}`);
}

/**
 * Metrics, Logs and Traces solution providers: an entry appears only for a confirmed-active
 * signal ('unknown' never invents one) AND when its detail fetches produced something to show —
 * a bare title card with every stat failed-soft reads as broken, so it is dropped instead.
 */
export function useTelemetrySolutions(): TelemetrySolutions {
  const { value: resolution, loading: stateLoading } = useSolutionState();
  // Availability only picks link targets; a pending probe falls back to /explore (never blocks).
  const metricsDrilldown = useDrilldownAvailable(METRICS_DRILLDOWN_APP_ID);
  const logsDrilldown = useDrilldownAvailable(LOGS_DRILLDOWN_APP_ID);
  const tracesDrilldown = useDrilldownAvailable(HOSTED_TRACES_APP_ID);

  const promDs = resolution?.state.metrics === 'active' ? resolution.prometheusDatasource : null;
  const lokiDs = resolution?.state.logs === 'active' ? resolution.lokiDatasource : null;
  const tempoDs = resolution?.state.traces === 'active' ? resolution.tempoDatasource : null;

  // Gate inside the callbacks (ds in the deps): an inactive or unknown signal never queries.
  // Values are wrapped so only an enabled run can produce a defined value: on the render where
  // a signal flips active, useAsync still reports the disabled run's settled `undefined`, which
  // must read as loading — not as a settled empty fetch (same guard as useKubernetesSolution).
  const metricsActivity = useAsync(
    async () => (promDs ? { activity: await fetchMetricsActivity(promDs) } : undefined),
    [promDs]
  );
  const logsActivity = useAsync(
    async () => (lokiDs ? { activity: await fetchLogsActivity(lokiDs) } : undefined),
    [lokiDs]
  );
  const tracesActivity = useAsync(
    async () => (tempoDs ? { activity: await fetchTracesActivity(tempoDs) } : undefined),
    [tempoDs]
  );
  // Best-effort enrichment, never a settle gate: undefined (pending or stale) and a rejection
  // both render the card without a service count, so this one needs no wrap.
  const tracesServices = useAsync(async () => (tempoDs ? fetchTracesServices(tempoDs) : undefined), [tempoDs]);

  let metrics: ExistingSolutionProviderResult = { loading: stateLoading, item: null };
  if (promDs) {
    // Hosts/disk are secondary/alert content; without a series count, name count, or sparkline
    // there is nothing to carry the card.
    metrics = toProviderResult(metricsActivity, (activity) =>
      activity.series == null && activity.names == null && activity.seriesSparkline == null
        ? null
        : buildMetricsItem({
            series: activity.series,
            dataPointsPerMinute: activity.dataPointsPerMinute,
            names: activity.names,
            hosts: activity.hosts,
            seriesSparkline: activity.seriesSparkline,
            disk: activity.disk,
            datasourceName: promDs.name,
            drilldownAvailable: metricsDrilldown,
          })
    );
  }

  let logs: ExistingSolutionProviderResult = { loading: stateLoading, item: null };
  if (lokiDs) {
    // Stats need bytes, the sparkline needs the series; with neither there is nothing to render.
    logs = toProviderResult(logsActivity, (activity) =>
      activity.bytes == null && activity.series == null
        ? null
        : buildLogsItem({
            bytes: activity.bytes,
            sources: activity.sources,
            volumeSeries: activity.series,
            datasourceName: lokiDs.name,
            drilldownAvailable: logsDrilldown,
          })
    );
  }

  let traces: ExistingSolutionProviderResult = { loading: stateLoading, item: null };
  if (tempoDs) {
    // The services count alone renders nothing (it is the stats secondary), so it cannot carry a
    // card — and a slow count must not stall the left card: the card ships without it and the
    // count fills in when it lands.
    traces = toProviderResult(tracesActivity, (activity) =>
      activity.spans == null && activity.series == null
        ? null
        : buildTracesItem({
            spans: activity.spans,
            services: tracesServices.value ?? null,
            throughputSeries: activity.series,
            datasourceName: tempoDs.name,
            drilldownAvailable: tracesDrilldown,
          })
    );
  }

  return { metrics, logs, traces };
}
