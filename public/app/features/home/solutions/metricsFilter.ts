import * as z from 'zod';

import { t } from '@grafana/i18n';
import { isValidRE2Regex } from 'app/features/alerting/unified/utils/matchers';

import { DatasourceBoundFilterSchema, parseStoredFilter } from './solutionFilter';

/** Label matchers narrowing the disk alert. An empty list does not narrow. */
export interface MetricsDiskScope {
  /** Filesystems whose `label` matches `regex` (anchored, RE2) are left out of the fill ratio. */
  excludes: Array<{ label: string; regex: string }>;
}

export function hasDiskSelection(scope: MetricsDiskScope): boolean {
  return scope.excludes.length > 0;
}

// Anything else would break every query the label is spliced into.
const LABEL_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** Why an exclusion's label cannot be saved, or null. The dialog's field rule and the stored filter's schema share it. */
export function labelIssue(label: string): string | null {
  const value = label.trim();
  if (value === '') {
    return t('home.solutions.metrics.filter.label-required', 'Choose a label');
  }
  return LABEL_NAME.test(value)
    ? null
    : t('home.solutions.metrics.filter.invalid-label', 'Label names may only contain letters, digits and underscores');
}

/**
 * Why an exclusion's pattern cannot be saved, or null. Patterns run as RE2 inside Prometheus; a
 * broken one fails every disk query, and a failed query reads as healthy disks.
 */
export function patternIssue(regex: string): string | null {
  const value = regex.trim();
  if (value === '') {
    return t('home.solutions.metrics.filter.pattern-required', 'Enter a pattern');
  }
  return isValidRE2Regex(value)
    ? null
    : t('home.solutions.metrics.filter.invalid-pattern', 'Pattern is not a valid regular expression');
}

// The one normalizer: rows are trimmed and must pass the field rules, or the whole filter is refused.
const ExcludesSchema = z
  .array(z.object({ label: z.string().trim(), regex: z.string().trim() }))
  .refine((rows) => rows.every((row) => !labelIssue(row.label) && !patternIssue(row.regex)));

const MetricsFilterSchema = DatasourceBoundFilterSchema.extend({ excludes: ExcludesSchema });

export type MetricsFilter = z.infer<typeof MetricsFilterSchema>;

/** Stored JSON → filter. Null for a missing/malformed value or an empty selection: both mean every filesystem. */
export function parseMetricsFilter(raw: string | undefined): MetricsFilter | null {
  return parseStoredFilter(raw, MetricsFilterSchema, (filter) => !hasDiskSelection(filter));
}

/** Human summary for tooltips. */
export function summarizeMetricsFilter(filter: MetricsFilter): string {
  return t('home.solutions.metrics.filter.summary-excludes', 'Excluding {{matchers}}', {
    matchers: filter.excludes.map((row) => `${row.label}: ${row.regex}`).join(', '),
    interpolation: { escapeValue: false },
  });
}
