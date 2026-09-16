import { t } from '@grafana/i18n';

import type { ExpressionIssue } from './issues';

/**
 * What to show the user for a given problem.
 *
 * Written out as a switch with literal `t()` calls because `make i18n-extract` reads the source -
 * a lookup built at runtime would produce no entries in the catalogue at all.
 */
export function expressionIssueMessage(issue: ExpressionIssue): string {
  const limit = issue.limit ?? 0;

  switch (issue.id) {
    case 'math.expression.required':
      return t('expressions.issue.math-expression-required', 'Enter a math expression.');

    case 'sql.expression.required':
      return t('expressions.issue.sql-expression-required', 'Enter a SQL expression.');

    case 'reduce.expression.required':
      return t('expressions.issue.reduce-expression-required', 'Select a query to reduce.');

    case 'reduce.replace-value.required':
      return t('expressions.issue.reduce-replace-value-required', 'Enter a replacement value.');

    case 'resample.expression.required':
      return t('expressions.issue.resample-expression-required', 'Select a query to resample.');

    case 'resample.window.required':
      return t('expressions.issue.resample-window-required', 'Enter a window duration, for example 10m.');

    case 'classic.conditions.required':
      return t('expressions.issue.classic-conditions-required', 'Add at least one condition.');

    case 'classic.condition.query.required':
      return t('expressions.issue.classic-condition-query-required', 'Every condition needs a query to read from.');

    case 'classic.condition.params.invalid':
      return t(
        'expressions.issue.classic-condition-params-invalid',
        'A range condition needs two values; the others need one.'
      );

    case 'threshold.expression.required':
      return t('expressions.issue.threshold-expression-required', 'Select a query to threshold.');

    case 'threshold.expression.bare-name':
      return t(
        'expressions.issue.threshold-expression-bare-name',
        'Refer to the query by name only, without a leading "$".'
      );

    case 'threshold.conditions.one-only':
      return t('expressions.issue.threshold-conditions-one-only', 'A threshold takes exactly one condition.');

    case 'threshold.value.required':
      return t('expressions.issue.threshold-value-required', 'Enter a threshold value.');

    case 'threshold.recovery.required':
      return t('expressions.issue.threshold-recovery-required', 'This value cannot be empty');

    case 'threshold.recovery.at-most':
      return t('expressions.issue.threshold-recovery-at-most', 'Enter a number less than or equal to {{limit}}', {
        limit,
      });

    case 'threshold.recovery.at-least':
      return t('expressions.issue.threshold-recovery-at-least', 'Enter a number more than or equal to {{limit}}', {
        limit,
      });

    case 'threshold.recovery.less-than':
      return t('expressions.issue.threshold-recovery-less-than', 'Enter a number less than {{limit}}', { limit });

    case 'threshold.recovery.more-than':
      return t('expressions.issue.threshold-recovery-more-than', 'Enter a number more than {{limit}}', { limit });

    case 'threshold.recovery.different':
      return t('expressions.issue.threshold-recovery-different', 'Enter a different number than {{limit}}', { limit });

    case 'threshold.recovery.same':
      return t('expressions.issue.threshold-recovery-same', 'Enter the same number as {{limit}}', { limit });
  }
}
