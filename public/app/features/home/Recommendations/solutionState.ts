import { useAsync } from 'react-use';

import { type DataSourceInstanceListItem } from '@grafana/data';

import { resolveKubernetesDatasource } from './kubernetesData';
import {
  createTtlCachedPromise,
  PROBE_TIMEOUT_MS,
  PROBE_TTL_MS,
  resolveBackendInstance,
  withRetry,
  withTimeout,
} from './probeUtils';
import { readScalar, runInstantQueries } from './promQuery';
import { DATA_LOOKBACK_HOURS, probeFound, tempoHasTraces } from './solutionDataProbes';
import { type SignalStatus, type SolutionState } from './solutionsMatrix';

// Span metrics prove Application Observability is in use: the spanmetrics connector emits
// traces_spanmetrics_*, OTel/Alloy emits traces_span_metrics_*.
const SPAN_METRICS_PROBE = `count(last_over_time(traces_spanmetrics_calls_total[${DATA_LOOKBACK_HOURS}h])) or count(last_over_time(traces_span_metrics_calls_total[${DATA_LOOKBACK_HOURS}h]))`;

// Cloud utility datasources hold platform telemetry, never the org's product data: excluded
// from the activity probes unconditionally.
const CLOUD_UTILITY_PROM_DATASOURCE_UIDS: ReadonlySet<string> = new Set([
  'grafanacloud-usage',
  'grafanacloud-ml-metrics',
]);
const CLOUD_UTILITY_LOKI_DATASOURCE_UIDS: ReadonlySet<string> = new Set([
  'grafanacloud-usage-insights',
  'grafanacloud-alert-state-history',
]);

// Hard ceiling per signal; the homepage never waits longer than this on one signal.
const SIGNAL_BUDGET_MS = 30_000;

export interface SolutionStateResolution {
  state: SolutionState;
  /** Datasources that won the logs/traces probes; null unless the signal is active. */
  lokiDatasource: DataSourceInstanceListItem | null;
  tempoDatasource: DataSourceInstanceListItem | null;
}

interface SignalResolution {
  status: SignalStatus;
  datasource: DataSourceInstanceListItem | null;
}

// Empty results are definitive 'inactive'; ANY rejection or timeout — transport errors,
// 401/403, every-candidate-errored — is 'unknown'. The two are never conflated.
async function resolveSignal(probe: () => Promise<DataSourceInstanceListItem | null>): Promise<SignalResolution> {
  try {
    const datasource = await withTimeout(probe(), SIGNAL_BUDGET_MS);
    return { status: datasource ? 'active' : 'inactive', datasource };
  } catch {
    return { status: 'unknown', datasource: null };
  }
}

// Recent-activity checks ride each datasource's label metadata endpoint: cheap, index-only,
// and an empty label set within the lookback is a definitive "no data".
async function prometheusHasRecentLabels(ds: DataSourceInstanceListItem): Promise<boolean> {
  const instance = await resolveBackendInstance(ds.uid);
  if (!instance) {
    return false;
  }
  const end = Math.floor(Date.now() / 1000);
  const start = end - DATA_LOOKBACK_HOURS * 3600;
  const res = await withRetry(() =>
    withTimeout(instance.getResource<{ data?: unknown }>('api/v1/labels', { start, end }), PROBE_TIMEOUT_MS)
  );
  return Array.isArray(res?.data) && res.data.length > 0;
}

async function lokiHasRecentLabels(ds: DataSourceInstanceListItem): Promise<boolean> {
  const instance = await resolveBackendInstance(ds.uid);
  if (!instance) {
    return false;
  }
  // Loki takes nanoseconds; ms * 1e6 mirrors LokiDatasource.getTimeRangeParams (precision loss accepted).
  const end = Date.now() * 1e6;
  const start = end - DATA_LOOKBACK_HOURS * 3600 * 1e9;
  const res = await withRetry(() =>
    withTimeout(instance.getResource<{ data?: unknown }>('labels', { start, end }), PROBE_TIMEOUT_MS)
  );
  // Loki responds data: null when empty.
  return Array.isArray(res?.data) && res.data.length > 0;
}

// A broken candidate counts as no span metrics (unlike the core-signal probes): one dead
// datasource must not hide the App Observability card behind an unknown — matches the
// kubernetes probe's failure direction.
async function prometheusHasSpanMetrics(ds: DataSourceInstanceListItem): Promise<boolean> {
  try {
    const frames = await withRetry(() => runInstantQueries({ probe: SPAN_METRICS_PROBE }, ds, PROBE_TIMEOUT_MS));
    return (readScalar(frames, 'probe') ?? 0) > 0;
  } catch {
    return false;
  }
}

// Each signal resolver settles on its own (never rejects), so Promise.all cannot discard
// sibling results.
async function resolveAllSignals(): Promise<SolutionStateResolution> {
  const [metrics, logs, traces, kubernetes, spanMetrics] = await Promise.all([
    resolveSignal(() => probeFound('prometheus', prometheusHasRecentLabels, CLOUD_UTILITY_PROM_DATASOURCE_UIDS)),
    resolveSignal(() => probeFound('loki', lokiHasRecentLabels, CLOUD_UTILITY_LOKI_DATASOURCE_UIDS)),
    resolveSignal(() => probeFound('tempo', tempoHasTraces)),
    resolveSignal(resolveKubernetesDatasource),
    resolveSignal(() => probeFound('prometheus', prometheusHasSpanMetrics, CLOUD_UTILITY_PROM_DATASOURCE_UIDS)),
  ]);

  return {
    state: {
      // Kubernetes data lives in a Prometheus (kube-state-metrics), so it proves metrics.
      metrics: kubernetes.status === 'active' ? 'active' : metrics.status,
      logs: logs.status,
      traces: traces.status,
      kubernetes: kubernetes.status,
      spanMetrics: spanMetrics.status,
    },
    lokiDatasource: logs.datasource,
    tempoDatasource: traces.datasource,
  };
}

// Carousel + solution providers mounting together fan out one resolution per TTL window.
const solutionStateResolution = createTtlCachedPromise(resolveAllSignals, PROBE_TTL_MS);

/**
 * Settled solution signals plus the datasources that won the logs/traces probes.
 * Never rejects; every field settles to a SignalStatus.
 */
export async function resolveSolutionState(): Promise<SolutionStateResolution> {
  return solutionStateResolution.get();
}

/** Reset the cached resolution (test seam). Does NOT reset kubernetesData's own TTL cache. */
export function resetSolutionStateResolution(): void {
  solutionStateResolution.reset();
}

export function useSolutionState(): { value?: SolutionStateResolution; loading: boolean } {
  return useAsync(resolveSolutionState, []);
}
