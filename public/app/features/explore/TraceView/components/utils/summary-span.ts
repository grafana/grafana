import { type TraceKeyValuePair } from '@grafana/data';
import { t } from '@grafana/i18n';

import { AGGREGATION_PREFIX } from '../constants/aggregation';
import { type SpanAggregation } from '../types/trace';

import { formatDuration } from './date';

/**
 * Split a span's tags into the raw `aggregation.*` tags written by span pruning and
 * everything else, preserving original order within each group. Lets SpanDetail keep
 * `aggregation.*` tags out of the regular attribute list and present them separately.
 */
export function partitionAggregationTags(tags: TraceKeyValuePair[]): {
  aggregationTags: TraceKeyValuePair[];
  otherTags: TraceKeyValuePair[];
} {
  const aggregationTags: TraceKeyValuePair[] = [];
  const otherTags: TraceKeyValuePair[] = [];
  for (const tag of tags) {
    if (typeof tag.key === 'string' && tag.key.startsWith(AGGREGATION_PREFIX)) {
      aggregationTags.push(tag);
    } else {
      otherTags.push(tag);
    }
  }
  return { aggregationTags, otherTags };
}

export interface SummaryDurationStat {
  label: string;
  value: string;
}

/**
 * Labeled min / median / max duration stats for a pruned summary span. Median is
 * included only when present (it requires outlier analysis); the average is
 * intentionally not surfaced. The processor emits durations in nanoseconds
 * (`duration_*_ns`); formatDuration expects microseconds, so each value is
 * scaled by 1000.
 *
 * Returns null when min or max is missing, so callers can fall back to the
 * span's single wall-clock duration rather than rendering a partial stat.
 */
export function getSummaryDurationStats(aggregation: SpanAggregation): SummaryDurationStat[] | null {
  const { durationMinNs, durationMedianNs, durationMaxNs } = aggregation;
  if (durationMinNs === undefined || durationMaxNs === undefined) {
    return null;
  }

  const stats: SummaryDurationStat[] = [
    { label: t('explore.summary-span.stat-min', 'Min'), value: formatDuration(durationMinNs / 1000) },
  ];
  if (durationMedianNs !== undefined) {
    stats.push({
      label: t('explore.summary-span.stat-median', 'Median'),
      value: formatDuration(durationMedianNs / 1000),
    });
  }
  stats.push({ label: t('explore.summary-span.stat-max', 'Max'), value: formatDuration(durationMaxNs / 1000) });
  return stats;
}
