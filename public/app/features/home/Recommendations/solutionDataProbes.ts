import { type DataSourceInstanceListItem } from '@grafana/data';

import { filterHealthyDatasources, findDatasourceWithData, listProbeCandidates, probeProxyGet } from './probeUtils';

// "Seen recently" lookback shared by all data probes, tolerating scrape/ingest gaps.
export const DATA_LOOKBACK_HOURS = 24;

// Span metrics prove App Observability is in use, under both supported emitter namings:
// the spanmetrics connector emits traces_spanmetrics_*, OTel/Alloy emits traces_span_metrics_*.
export const SPAN_METRICS_PROBE = `count(last_over_time(traces_spanmetrics_calls_total[${DATA_LOOKBACK_HOURS}h])) or count(last_over_time(traces_span_metrics_calls_total[${DATA_LOOKBACK_HOURS}h]))`;

/**
 * The first probed healthy candidate datasource of `type` where `hasData` confirms data, or null
 * when no candidate confirmed data. Rejects only when listing datasources fails.
 */
export async function probeFound(
  type: string,
  hasData: (ds: DataSourceInstanceListItem) => Promise<boolean>,
  excludeUids?: ReadonlySet<string>
): Promise<DataSourceInstanceListItem | null> {
  const candidates = await filterHealthyDatasources(await listProbeCandidates(type, undefined, excludeUids));
  return findDatasourceWithData(candidates, hasData);
}

interface TempoSearchResponse {
  traces?: unknown[];
}

/**
 * One matching trace in the lookback proves data exists. Uses Tempo's search HTTP API via the
 * datasource proxy: the frontend query path misreads streamed empty results as data (observed
 * live with traceQLStreaming) and the resource router 404s Tempo paths on cloud stacks.
 */
export async function tempoHasTraces(ds: Pick<DataSourceInstanceListItem, 'uid'>): Promise<boolean> {
  const end = Math.floor(Date.now() / 1000);
  const start = end - DATA_LOOKBACK_HOURS * 3600;
  const res = await probeProxyGet<TempoSearchResponse>(ds.uid, 'api/search', { q: '{}', limit: 1, start, end });
  return Array.isArray(res?.traces) && res.traces.length > 0;
}
