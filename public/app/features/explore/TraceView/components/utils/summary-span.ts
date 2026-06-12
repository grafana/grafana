import { type SpanAggregation } from '../types/trace';

import { formatDuration } from './date';

/**
 * Builds the `min | median | max` (or `min | max`) duration string shown on
 * pruned summary spans. The processor emits these durations in nanoseconds
 * (`duration_*_ns`); formatDuration expects microseconds, so each value is
 * scaled by 1000.
 *
 * Returns null when min or max is missing, so callers can fall back to the
 * span's single wall-clock duration rather than rendering a partial string.
 * The average duration is intentionally not surfaced.
 */
export function formatSummaryDurations(aggregation: SpanAggregation): string | null {
  const { durationMinNs, durationMedianNs, durationMaxNs } = aggregation;
  if (durationMinNs === undefined || durationMaxNs === undefined) {
    return null;
  }

  const min = formatDuration(durationMinNs / 1000);
  const max = formatDuration(durationMaxNs / 1000);
  if (durationMedianNs !== undefined) {
    return `${min} | ${formatDuration(durationMedianNs / 1000)} | ${max}`;
  }
  return `${min} | ${max}`;
}
