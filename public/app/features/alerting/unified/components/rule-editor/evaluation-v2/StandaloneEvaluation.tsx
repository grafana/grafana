import { useFormContext } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Button, Field, Input, Stack } from '@grafana/ui';

import { evaluateEveryValidationOptions } from '../../../group-details/validation';
import { DEFAULT_GROUP_EVALUATION_INTERVAL } from '../../../rule-editor/formDefaults';
import { type RuleFormValues } from '../../../types/rule-form';
import { EvaluationGroupQuickPick } from '../EvaluationGroupQuickPick';

interface StandaloneEvaluationProps {
  onOptIn?: () => void;
  showOptInLink?: boolean;
}

export function StandaloneEvaluation({ onOptIn, showOptInLink }: StandaloneEvaluationProps) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<RuleFormValues>();

  const evaluateEvery = watch('evaluateEvery');

  const setEvaluationInterval = (interval: string) => {
    setValue('evaluateEvery', interval, { shouldValidate: true });
    // Keep group in sync: the ruler API requires a non-empty group name.
    // In the v2 path we derive it from the evaluation interval so that rules
    // sharing the same cadence land in the same ruler group.
    setValue('group', interval);
  };

  return (
    <Stack direction="column" gap={2}>
      <Field
        noMargin
        label={t('alerting.evaluation-v2.standalone.interval-label', 'Evaluation interval')}
        description={t('alerting.evaluation-v2.standalone.interval-description', 'How often this rule is evaluated.')}
        error={errors.evaluateEvery?.message}
        invalid={Boolean(errors.evaluateEvery)}
      >
        <Input
          id="evaluate-every-input"
          width={16}
          placeholder={DEFAULT_GROUP_EVALUATION_INTERVAL}
          {...register('evaluateEvery', evaluateEveryValidationOptions<Pick<RuleFormValues, 'evaluateEvery'>>([]))}
        />
      </Field>
      <EvaluationGroupQuickPick currentInterval={evaluateEvery} onSelect={setEvaluationInterval} />
      {showOptInLink && onOptIn && (
        <Button variant="secondary" fill="text" size="sm" onClick={onOptIn}>
          <Trans i18nKey="alerting.evaluation-v2.standalone.opt-in">I want to add to an evaluation chain</Trans>
        </Button>
      )}
    </Stack>
  );
}
