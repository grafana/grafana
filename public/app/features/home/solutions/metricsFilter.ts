import * as z from 'zod';

import { t } from '@grafana/i18n';
import { isValidRE2Regex } from 'app/features/alerting/unified/utils/matchers';

import { DatasourceBoundFilterSchema, parseStoredFilter } from './solutionFilter';
import { activeExcludes, hasDiskSelection, type MetricsDiskScope } from './telemetryData';

// Anything else would break every query the label is spliced into.
const LABEL_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

// Patterns run as RE2 inside Prometheus; a broken one fails every disk query, and a failed query
// reads as healthy disks. The shared check catches structural errors; lookarounds and
// backreferences pass it but do not exist in RE2, so they are refused here.
const RE2_UNSUPPORTED = /\(\?<?[=!]|\\[1-9]/;
const isRE2 = (pattern: string) => !RE2_UNSUPPORTED.test(pattern) && isValidRE2Regex(pattern);

const ExcludesSchema = z
  .array(z.object({ label: z.string(), regex: z.string() }))
  .transform((rows) => activeExcludes({ excludes: rows }))
  .refine((rows) => rows.every((row) => LABEL_NAME.test(row.label)), {
    error: () =>
      t('home.solutions.metrics.filter.invalid-label', 'Label names may only contain letters, digits and underscores.'),
  })
  .refine((rows) => rows.every((row) => isRE2(row.regex)), {
    error: () => t('home.solutions.metrics.filter.invalid-pattern', 'Pattern is not a valid regular expression.'),
  });

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

/** Message that blocks saving the scope, or null when it is usable. The schema owns the rules. */
export function validateMetricsScope(scope: MetricsDiskScope): string | null {
  const result = ExcludesSchema.safeParse(scope.excludes);
  return result.success ? null : result.error.issues[0].message;
}
