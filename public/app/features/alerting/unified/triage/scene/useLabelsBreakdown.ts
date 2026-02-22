import { useAsync } from 'react-use';

import { TimeRange } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { useTimeRange } from '@grafana/scenes-react';

import { logError } from '../../Analytics';
import { DATASOURCE_UID, METRIC_NAME } from '../constants';

import { INTERNAL_LABELS } from './tagKeysProviders';
import { useQueryFilter } from './utils';

export const TOP_LABEL_COUNT = 5;
const TOP_VALUES_COUNT = 10;

export interface LabelValueCount {
  value: string;
  count: number;
  firing: number;
  pending: number;
}

export interface TopLabel {
  key: string;
  count: number;
  firing: number;
  pending: number;
  values: LabelValueCount[];
}

export function useLabelsBreakdown(): {
  labels: TopLabel[];
  isLoading: boolean;
  error: Error | undefined;
} {
  const [timeRange] = useTimeRange();
  const filter = useQueryFilter();

  const { loading, error, value } = useAsync(async () => {
    const series = await fetchSeries(timeRange, filter);
    return computeTopLabels(series, Infinity, Infinity);
  }, [timeRange, filter]);

  if (error) {
    logError(error, { context: 'useLabelsBreakdown' });
  }

  return { labels: value ?? [], isLoading: loading, error };
}

/**
 * Given an array of series (label maps), compute the top N label keys
 * by frequency, along with value distributions for each key.
 *
 * @param maxKeys – number of label keys to return (default 5, pass Infinity for all)
 * @param maxValues – number of values per key to return (default 10, pass Infinity for all)
 */
export function computeTopLabels(
  series: Array<Record<string, string>>,
  maxKeys = TOP_LABEL_COUNT,
  maxValues = TOP_VALUES_COUNT
): TopLabel[] {
  const keyStats = new Map<string, LabelKeyStats>();

  for (const s of series) {
    const isFiring = s.alertstate === 'firing';
    const isPending = s.alertstate === 'pending';

    for (const [key, value] of Object.entries(s)) {
      if (INTERNAL_LABELS.has(key)) {
        continue;
      }

      const stats = getOrCreate(keyStats, key, () => ({
        count: 0,
        firing: 0,
        pending: 0,
        values: new Map<string, LabelValueStats>(),
      }));
      stats.count++;

      const valueStats = getOrCreate(stats.values, value, () => ({
        count: 0,
        firing: 0,
        pending: 0,
      }));
      valueStats.count++;

      if (isFiring) {
        stats.firing++;
        valueStats.firing++;
      } else if (isPending) {
        stats.pending++;
        valueStats.pending++;
      }
    }
  }

  return [...keyStats.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, maxKeys)
    .map(([key, stats]) => ({
      key,
      count: stats.count,
      firing: stats.firing,
      pending: stats.pending,
      values: [...stats.values.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, maxValues)
        .map(([value, vs]) => ({
          value,
          count: vs.count,
          firing: vs.firing,
          pending: vs.pending,
        })),
    }));
}

// --- Implementation details ---

interface LabelValueStats {
  count: number;
  firing: number;
  pending: number;
}

interface LabelKeyStats {
  count: number;
  firing: number;
  pending: number;
  values: Map<string, LabelValueStats>;
}

function getOrCreate<K, V>(map: Map<K, V>, key: K, factory: () => V): V {
  let val = map.get(key);
  if (val === undefined) {
    val = factory();
    map.set(key, val);
  }
  return val;
}

/**
 * Build a PromQL dedup expression that returns one series per active alert instance.
 *
 * The query has two halves joined by `or`:
 *   1. All firing instances in the range (take the last sample).
 *   2. All pending instances in the range, MINUS any that also fired
 *      (`unless ignoring(alertstate, grafana_alertstate)`).
 *
 * This ensures each instance is counted exactly once, with firing taking
 * priority over pending when an instance transitioned between states.
 * Matches the logic in queries.ts getAlertsSummariesQuery.
 */
function buildDedupExpr(filter: string, range: string): string {
  const firingFilter = filter ? `alertstate="firing",${filter}` : 'alertstate="firing"';
  const pendingFilter = filter ? `alertstate="pending",${filter}` : 'alertstate="pending"';
  return (
    `last_over_time(${METRIC_NAME}{${firingFilter}}[${range}]) or ` +
    `(last_over_time(${METRIC_NAME}{${pendingFilter}}[${range}]) ` +
    `unless ignoring(alertstate, grafana_alertstate) ` +
    `last_over_time(${METRIC_NAME}{${firingFilter}}[${range}]))`
  );
}

async function fetchSeries(timeRange: TimeRange, filter: string): Promise<Array<Record<string, string>>> {
  const ds = await getDataSourceSrv().get({ uid: DATASOURCE_UID });

  if (!('getResource' in ds) || typeof ds.getResource !== 'function') {
    return [];
  }

  const rangeSecs = timeRange.to.unix() - timeRange.from.unix();
  const query = buildDedupExpr(filter, `${rangeSecs}s`);

  const response = await ds.getResource('api/v1/query', {
    query,
    time: String(timeRange.to.unix()),
  });

  // Instant query returns { data: { result: [{ metric: {...}, value: [...] }] } }
  const results: Array<{ metric: Record<string, string> }> = response?.data?.result ?? [];
  return results.map((r) => r.metric);
}
