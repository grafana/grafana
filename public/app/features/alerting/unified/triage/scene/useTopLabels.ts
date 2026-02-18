import { useEffect, useState } from 'react';

import { TimeRange } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { useTimeRange } from '@grafana/scenes-react';

import { DATASOURCE_UID, METRIC_NAME } from '../constants';

import { INTERNAL_LABELS } from './tagKeysProviders';

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
 */
export function computeTopLabels(series: Array<Record<string, string>>): TopLabel[] {
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
    .slice(0, TOP_LABEL_COUNT)
    .map(([key, count]) => {
      const valueCounts = keyValueCounts.get(key) ?? new Map<string, number>();
      const values = [...valueCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, TOP_VALUES_COUNT)
        .map(([value, valueCount]) => ({ value, count: valueCount }));

      return { key, count, values };
    });
}

async function fetchSeries(timeRange: TimeRange): Promise<Array<Record<string, string>>> {
  const ds = await getDataSourceSrv().get({ uid: DATASOURCE_UID });

  if (!('getResource' in ds) || typeof ds.getResource !== 'function') {
    return [];
  }

  const response = await ds.getResource('api/v1/series', {
    'match[]': METRIC_NAME,
    start: String(timeRange.from.unix()),
    end: String(timeRange.to.unix()),
  });

  return response?.data ?? [];
}

export function useTopLabels(): { topLabels: TopLabel[]; isLoading: boolean } {
  const [timeRange] = useTimeRange();
  const [topLabels, setTopLabels] = useState<TopLabel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    fetchSeries(timeRange)
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
  }, [timeRange]);

  return { topLabels, isLoading };
}
