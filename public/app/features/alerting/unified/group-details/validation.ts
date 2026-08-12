import { type FieldPath, type FieldValues, type RegisterOptions } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { type RulerRuleDTO } from 'app/types/unified-alerting-dto';

import { rulesInSameGroupHaveInvalidFor } from '../state/actions';
import { MIN_TIME_RANGE_STEP_S } from '../utils/constants';
import { getAlertInfo } from '../utils/rules';
import { formatPrometheusDuration, safeParsePrometheusDuration } from '../utils/time';

export const evaluateEveryValidationOptions = <
  TFieldValues extends FieldValues,
  TFieldName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(
  rules: RulerRuleDTO[]
): RegisterOptions<TFieldValues, TFieldName> => ({
  required: {
    value: true,
    message: t('alerting.evaluate-every-validation-options.message.required', 'Required.'),
  },
  validate: (evaluateEvery: string) => {
    const duration = safeParsePrometheusDuration(evaluateEvery);
    if (duration <= 0) {
      return t(
        'alerting.evaluate-every-validation-options.message.none-not-allowed',
        'Evaluation interval cannot be None and must be a valid duration.'
      );
    }

    if (duration < MIN_TIME_RANGE_STEP_S * 1000) {
      return `Cannot be less than ${MIN_TIME_RANGE_STEP_S} seconds.`;
    }

    if (duration % (MIN_TIME_RANGE_STEP_S * 1000) !== 0) {
      return `Must be a multiple of ${MIN_TIME_RANGE_STEP_S} seconds.`;
    }

    if (rulesInSameGroupHaveInvalidFor(rules, evaluateEvery).length === 0) {
      return true;
    }

    const rulePendingPeriods = rules.map((rule) => {
      const { forDuration } = getAlertInfo(rule, evaluateEvery);
      return forDuration ? safeParsePrometheusDuration(forDuration) : null;
    });
    // 0 is a special case which disables the pending period at all
    const smallestPendingPeriod = Math.min(
      ...rulePendingPeriods.filter((period): period is number => period !== null && period !== 0)
    );
    return `Evaluation interval should be smaller or equal to "pending period" values for existing rules in this rule group. Choose a value smaller than or equal to "${formatPrometheusDuration(smallestPendingPeriod)}".`;
  },
});
