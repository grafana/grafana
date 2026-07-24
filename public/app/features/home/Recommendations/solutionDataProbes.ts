import { type DataQuery, type DataSourceInstanceListItem, dateTime, type TimeRange } from '@grafana/data';

import { findDatasourceWithData, listProbeCandidates, PROBE_TIMEOUT_MS, withRetry } from './probeUtils';
import { runDatasourceQueries } from './promQuery';

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

interface TempoSearchQuery extends DataQuery {
  query: string;
  limit: number;
}

export async function tempoHasTraces(ds: DataSourceInstanceListItem): Promise<boolean> {
  const toTime = dateTime();
  const fromTime = dateTime().subtract(DATA_LOOKBACK_HOURS, 'h');
  const range: TimeRange = {
    from: fromTime,
    to: toTime,
    raw: { from: `now-${DATA_LOOKBACK_HOURS}h`, to: 'now' },
  };
  // Tempo search target: match-all TraceQL, one result is enough to prove data exists.
  const target: TempoSearchQuery = { refId: 'traces', queryType: 'traceql', query: '{}', limit: 1 };
  const frames = await withRetry(() => runDatasourceQueries([target], range, ds, PROBE_TIMEOUT_MS));
  return frames.some((frame) => frame.length > 0);
}
