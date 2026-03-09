import { useEffect } from 'react';

import { getPrometheusTime } from '@grafana/prometheus';
import { getDataSourceSrv } from '@grafana/runtime';
import { useTimeRange } from '@grafana/scenes-react';

import { useAsync } from '../../hooks/useAsync';
import { DATASOURCE_UID, INTERNAL_LABELS, METRIC_NAME } from '../constants';

import { isPrometheusDatasource, useQueryFilter } from './utils';

export interface LabelValueCount {
  value: string;
  firing: number;
  pending: number;
}

export interface LabelStats {
  key: string;
  firing: number;
  pending: number;
  values: LabelValueCount[];
}

export function useLabelsBreakdown(): {
  labels: LabelStats[];
  isLoading: boolean;
} {
  const filter = useQueryFilter();
  const [timeRange] = useTimeRange();

  const [{ execute }, state] = useAsync(async (matchSelector: string, start: string, end: string) => {
    const ds = await getDataSourceSrv().get({ uid: DATASOURCE_UID });
    if (!isPrometheusDatasource(ds)) {
      throw new Error(`Expected a Prometheus datasource but got "${ds.type}"`);
    }
    const result = await ds.metadataRequest('/api/v1/series', { 'match[]': matchSelector, start, end });
    const raw: Array<Record<string, string>> = result?.data?.data ?? [];
    return computeLabelStats(deduplicateSeries(raw));
  });

  useEffect(() => {
    const matchSelector = filter
      ? `${METRIC_NAME}{alertstate=~"firing|pending",${filter}}`
      : `${METRIC_NAME}{alertstate=~"firing|pending"}`;

    const start = getPrometheusTime(timeRange.from, false).toString();
    const end = getPrometheusTime(timeRange.to, true).toString();

    execute(matchSelector, start, end);
  }, [execute, filter, timeRange]);

  return {
    labels: state.result ?? [],
    isLoading: state.status === 'loading' || state.status === 'not-executed',
  };
}

/**
 * Deduplicate series so that when the same alert instance appears as both
 * "firing" and "pending" within the time window, only the "firing" entry is
 * kept — mirroring the `unless ignoring(alertstate, grafana_alertstate)`
 * logic used in the previous PromQL query.
 *
 * Two series are considered the same instance when all their labels match
 * except for `alertstate` and `grafana_alertstate`.
 */
const collator = new Intl.Collator();

export function deduplicateSeries(series: Array<Record<string, string>>): Array<Record<string, string>> {
  // Labels that differentiate alertstate but not the underlying instance identity.
  const STATE_LABELS = new Set(['alertstate', 'grafana_alertstate']);

  function fingerprint(s: Record<string, string>): string {
    return Object.entries(s)
      .filter(([k]) => !STATE_LABELS.has(k))
      .sort(([a], [b]) => collator.compare(a, b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
  }

  // Group series by their instance fingerprint.
  const groups = new Map<string, Array<Record<string, string>>>();
  for (const s of series) {
    const fp = fingerprint(s);
    const group = groups.get(fp);
    if (group) {
      group.push(s);
    } else {
      groups.set(fp, [s]);
    }
  }

  // For each group: prefer firing over pending.
  const result: Array<Record<string, string>> = [];
  for (const group of groups.values()) {
    const firing = group.filter((s) => s.alertstate === 'firing');
    result.push(...(firing.length > 0 ? firing : group));
  }
  return result;
}

/**
 * Given an array of series (label maps), compute label keys sorted by frequency,
 * along with value distributions for each key.
 */
export function computeLabelStats(series: Array<Record<string, string>>): LabelStats[] {
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
    .map(([key, stats]) => ({
      key,
      firing: stats.firing,
      pending: stats.pending,
      values: [...stats.values.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .map(([value, vs]) => ({
          value,
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
