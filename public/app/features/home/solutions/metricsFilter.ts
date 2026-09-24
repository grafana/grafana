import * as z from 'zod';

import { t } from '@grafana/i18n';

import { DatasourceBoundFilterSchema, parseStoredFilter } from './solutionFilter';
import { hasDiskSelection, type MetricsDiskScope } from './telemetryData';

// Anything else would break every query the label is spliced into.
const LABEL_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const Excludes = z
  .array(z.object({ label: z.string().trim(), regex: z.string().trim() }))
  // The dialog allows half-filled rows while typing; they select nothing and are dropped.
  .transform((rows) => rows.filter((row) => row.label !== '' && row.regex !== ''))
  .refine((rows) => rows.every((row) => LABEL_NAME.test(row.label)));

const MetricsFilterSchema = DatasourceBoundFilterSchema.extend({ excludes: Excludes });

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

/** Message that blocks saving the scope, or null when it is usable. */
export function validateMetricsScope(scope: MetricsDiskScope): string | null {
  return scope.excludes.some((row) => row.label.trim() !== '' && !LABEL_NAME.test(row.label.trim()))
    ? t('home.solutions.metrics.filter.invalid-label', 'Label names may only contain letters, digits and underscores.')
    : null;
}
