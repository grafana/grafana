import { useEffect, useState } from 'react';

import { TimeRange } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { useTimeRange } from '@grafana/scenes-react';

import { DATASOURCE_UID, METRIC_NAME } from '../constants';

import { INTERNAL_LABELS } from './tagKeysProviders';
import { useQueryFilter } from './utils';

const TOP_LABEL_COUNT = 5;
const TOP_VALUES_COUNT = 10;

export interface LabelValueCount {
  value: string;
  count: number;
}

export interface TopLabel {
  key: string;
  count: number;
  values: LabelValueCount[];
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
  const keyCounts = new Map<string, number>();
  const keyValueCounts = new Map<string, Map<string, number>>();

  for (const s of series) {
    for (const [key, value] of Object.entries(s)) {
      if (INTERNAL_LABELS.has(key)) {
        continue;
      }
      keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);

      let valueCounts = keyValueCounts.get(key);
      if (!valueCounts) {
        valueCounts = new Map<string, number>();
        keyValueCounts.set(key, valueCounts);
      }
      valueCounts.set(value, (valueCounts.get(value) ?? 0) + 1);
    }
  }

  return [...keyCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeys)
    .map(([key, count]) => {
      const valueCounts = keyValueCounts.get(key) ?? new Map<string, number>();
      const values = [...valueCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxValues)
        .map(([value, valueCount]) => ({ value, count: valueCount }));

      return { key, count, values };
    });
}

/**
 * Build a dedup expression that returns one series per active alert instance.
 * Firing takes priority — instances that transitioned between states are counted
 * only once in their firing state. Matches the logic in queries.ts getAlertsSummariesQuery.
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

export function useTopLabels(): { topLabels: TopLabel[]; isLoading: boolean } {
  const [timeRange] = useTimeRange();
  const filter = useQueryFilter();
  const [topLabels, setTopLabels] = useState<TopLabel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    fetchSeries(timeRange, filter)
      .then((series) => {
        if (!cancelled) {
          setTopLabels(computeTopLabels(series));
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTopLabels([]);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [timeRange, filter]);

  return { topLabels, isLoading };
}

/**
 * Fetch all labels (no limits) — intended to be called inside a drawer
 * component so data is only fetched when the drawer is mounted/open.
 */
export function useAllLabels(): { allLabels: TopLabel[]; isLoading: boolean } {
  const [timeRange] = useTimeRange();
  const filter = useQueryFilter();
  const [allLabels, setAllLabels] = useState<TopLabel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    fetchSeries(timeRange, filter)
      .then((series) => {
        if (!cancelled) {
          setAllLabels(computeTopLabels(series, Infinity, Infinity));
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAllLabels([]);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [timeRange, filter]);

  return { allLabels, isLoading };
}
