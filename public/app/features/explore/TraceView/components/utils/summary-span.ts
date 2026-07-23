import { css } from '@emotion/css';

import { type GrafanaTheme2, type TraceKeyValuePair } from '@grafana/data';
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

/**
 * Pill badge that shows a summary span's aggregated span_count. Shared by the
 * waterfall row (SpanBarRow) and the SpanDetail header so the two stay visually
 * identical. Callers add their own context-specific margins and set the
 * background/text color inline from the service color; the theme defaults here
 * apply only when no color is provided.
 */
export const getSummaryCountBadgeStyle = (theme: GrafanaTheme2) =>
  css({
    background: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.pill,
    color: theme.colors.text.primary,
    display: 'inline-block',
    fontSize: '0.85em',
    fontWeight: 500,
    lineHeight: 1.4,
    padding: '0 6px',
    verticalAlign: 'middle',
  });

export interface SummaryDurationStat {
  label: string;
  // Lower-case label sourced from its own translation, for contexts that render
  // the stat inline (e.g. SpanDetail). Casing is authored per-locale in i18n
  // rather than forced in code, which is not locale-aware for translated text.
  labelLower: string;
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
    {
      label: t('explore.summary-span.stat-min', 'Min'),
      labelLower: t('explore.summary-span.stat-min-lower', 'min'),
      value: formatDuration(durationMinNs / 1000),
    },
  ];
  if (durationMedianNs !== undefined) {
    stats.push({
      label: t('explore.summary-span.stat-median', 'Median'),
      labelLower: t('explore.summary-span.stat-median-lower', 'median'),
      value: formatDuration(durationMedianNs / 1000),
    });
  }
  stats.push({
    label: t('explore.summary-span.stat-max', 'Max'),
    labelLower: t('explore.summary-span.stat-max-lower', 'max'),
    value: formatDuration(durationMaxNs / 1000),
  });
  return stats;
}
