import { useId } from 'react';
import { useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Field, Input, Stack } from '@grafana/ui';

import { evaluateEveryValidationOptions } from '../../group-details/validation';
import { type RuleFormValues } from '../../types/rule-form';

import { EvaluationGroupQuickPick } from './EvaluationGroupQuickPick';

export const EVALUATION_INTERVAL_FIELD_TEST_ID = 'evaluation-interval';

interface RuleEvaluationIntervalFieldProps {
  // Override the input's DOM id when an e2e selector or external label targets it
  // directly. Defaults to a generated id so the field can be rendered multiple
  // times on the same page without collisions.
  inputId?: string;
}

/**
 * Renders the per-rule "Evaluation interval" input plus its quick-pick chips,
 * wired to `evaluateEvery` on the surrounding `RuleFormValues` form context.
 *
 * Used by both the main alert rule editor (Set interval mode) and the
 * create-from-panel drawer when the rule will be saved without a group.
 */
export function RuleEvaluationIntervalField({ inputId }: RuleEvaluationIntervalFieldProps = {}) {
  const generatedId = useId();
  const id = inputId ?? generatedId;

  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<RuleFormValues>();
  const evaluateEvery = watch('evaluateEvery');

  return (
    <Stack direction="column" gap={1.5}>
      <Field
        noMargin
        data-testid={EVALUATION_INTERVAL_FIELD_TEST_ID}
        label={t('alerting.rule-form.evaluation.interval-label', 'Evaluation interval')}
        error={errors.evaluateEvery?.message}
        invalid={Boolean(errors.evaluateEvery?.message)}
        htmlFor={id}
      >
        <Input
          id={id}
          width={8}
          {...register('evaluateEvery', evaluateEveryValidationOptions<{ evaluateEvery: string }>([]))}
        />
      </Field>
      <EvaluationGroupQuickPick
        currentInterval={evaluateEvery}
        onSelect={(interval) => setValue('evaluateEvery', interval)}
      />
    </Stack>
  );
}
