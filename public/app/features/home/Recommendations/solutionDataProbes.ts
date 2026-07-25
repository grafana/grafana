import { type DataSourceInstanceListItem } from '@grafana/data';

import { findDatasourceWithData, listProbeCandidates, probeProxyGet } from './probeUtils';

// "Seen recently" lookback shared by all data probes, tolerating scrape/ingest gaps.
export const DATA_LOOKBACK_HOURS = 24;

/**
 * The first probed candidate datasource of `type` where `hasData` confirms data, or null when
 * every candidate probed clean-and-empty (or none exist). Throws when nothing was found and any
 * candidate errored: an errored datasource may hold the data, so absence is not settled.
 */
export async function probeFound(
  type: string,
  hasData: (ds: DataSourceInstanceListItem) => Promise<boolean>,
  excludeUids?: ReadonlySet<string>
): Promise<DataSourceInstanceListItem | null> {
  const candidates = await listProbeCandidates(type, undefined, excludeUids);
  let errored = 0;
  // findDatasourceWithData requires a non-throwing callback; count failures for the unknown check.
  const guardedHasData = async (ds: DataSourceInstanceListItem) => {
    try {
      return await hasData(ds);
    } catch {
      errored++;
      return false;
    }
  };
  const found = await findDatasourceWithData(candidates, guardedHasData);
  if (found) {
    return found;
  }
  if (errored > 0) {
    throw new Error(`${errored} ${type} datasource probe(s) failed with no data found elsewhere`);
  }
  return null;
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
  // Single attempt so the traces signal budget outlasts the whole probe (see solutionState).
  const res = await probeProxyGet<TempoSearchResponse>(
    ds.uid,
    'api/search',
    { q: '{}', limit: 1, start, end },
    { retry: false }
  );
  return Array.isArray(res?.traces) && res.traces.length > 0;
}
