import { useMemo } from 'react';

import { useQueryRunner } from '@grafana/scenes-react';

import { INTERNAL_LABELS } from '../constants';

import { dataFrameToLabelMaps } from './dataFrameUtils';
import { uniqueAlertInstancesQuery } from './queries';
import { useQueryFilter } from './utils';

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
  const dataProvider = useQueryRunner({ queries: [uniqueAlertInstancesQuery(filter)] });
  const { data } = dataProvider.useState();
  const frame = data?.series?.at(0);

  const labels = useMemo(() => {
    if (!frame) {
      return [];
    }
    return computeLabelStats(dataFrameToLabelMaps(frame));
  }, [frame]);

  return { labels, isLoading: !dataProvider.isDataReadyToDisplay() };
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
