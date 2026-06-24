import { t } from '@grafana/i18n';

import { type SpanAggregation } from '../types/trace';

import { formatDuration } from './date';

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
    stats.push({ label: t('explore.summary-span.stat-median', 'Median'), value: formatDuration(durationMedianNs / 1000) });
  }
  stats.push({ label: t('explore.summary-span.stat-max', 'Max'), value: formatDuration(durationMaxNs / 1000) });
  return stats;
}
