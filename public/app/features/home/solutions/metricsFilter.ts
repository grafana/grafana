import * as z from 'zod';

import { type DataFrame, type DataSourceInstanceListItem, FieldType } from '@grafana/data';
import { t } from '@grafana/i18n';

import { runInstantQueries } from './promQuery';
import { DatasourceBoundFilterSchema, parseStoredFilter } from './solutionFilter';
import { hasDiskSelection, type MetricsDiskScope } from './telemetryData';

// Anything else would break every query the label is spliced into.
const LABEL_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const Excludes = z
  .array(z.object({ label: z.string().trim(), regex: z.string().trim() }))
  // The dialog allows half-filled rows while typing; they select nothing and are dropped.
  .transform((rows) => rows.filter((row) => row.label !== '' && row.regex !== ''))
  .refine((rows) => rows.every((row) => LABEL_NAME.test(row.label)));

const MetricsFilterSchema = DatasourceBoundFilterSchema.extend({
  excludes: Excludes,
  ratioExpr: z.string().trim(),
});

export type MetricsFilter = z.infer<typeof MetricsFilterSchema>;

/** Stored JSON → filter. Null for a missing/malformed value or an empty selection: both mean every filesystem. */
export function parseMetricsFilter(raw: string | undefined): MetricsFilter | null {
  return parseStoredFilter(raw, MetricsFilterSchema, (filter) => !hasDiskSelection(filter));
}

/** Human summary for tooltips. */
export function summarizeMetricsFilter(filter: MetricsFilter): string {
  if (filter.ratioExpr !== '') {
    return t('home.solutions.metrics.filter.summary-expression', 'Custom expression');
  }
  return t('home.solutions.metrics.filter.summary-excludes', 'Excluding {{matchers}}', {
    matchers: filter.excludes.map((row) => `${row.label}: ${row.regex}`).join(', '),
    interpolation: { escapeValue: false },
  });
}

/**
 * Message that blocks saving the scope, or null when it is usable. A custom expression is run once:
 * a broken one would otherwise silently blank the alert, which reads as "disks fine".
 */
export async function validateMetricsScope(
  scope: MetricsDiskScope,
  ds: Pick<DataSourceInstanceListItem, 'uid' | 'type'>
): Promise<string | null> {
  if (scope.excludes.some((row) => row.label.trim() !== '' && !LABEL_NAME.test(row.label.trim()))) {
    return t(
      'home.solutions.metrics.filter.invalid-label',
      'Label names may only contain letters, digits and underscores.'
    );
  }
  const expr = scope.ratioExpr.trim();
  if (expr === '') {
    return null;
  }
  let frames: DataFrame[];
  try {
    frames = await runInstantQueries({ ratio: expr }, ds);
  } catch (error) {
    return t('home.solutions.metrics.filter.expression-failed', 'The expression failed: {{message}}', {
      message: error instanceof Error ? error.message : String(error),
      interpolation: { escapeValue: false },
    });
  }
  const fields = frames
    .filter((frame) => frame.refId === 'ratio')
    .flatMap((frame) => frame.fields.filter((field) => field.type === FieldType.number));
  if (fields.length === 0) {
    return t(
      'home.solutions.metrics.filter.expression-empty',
      'The expression returned no series. It must return one value per filesystem.'
    );
  }
  if (fields.some((field) => !field.labels?.instance)) {
    return t(
      'home.solutions.metrics.filter.expression-no-instance',
      'Every series the expression returns must carry an instance label.'
    );
  }
  if (
    fields.some((field) => field.values.some((v) => typeof v === 'number' && Number.isFinite(v) && (v < 0 || v > 1)))
  ) {
    return t(
      'home.solutions.metrics.filter.expression-range',
      'The expression must return values between 0 (empty) and 1 (full).'
    );
  }
  return null;
}
