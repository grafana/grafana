import { useEffect, useState } from 'react';
import { Controller, type RegisterOptions, useFormContext } from 'react-hook-form';
import { useFirstMountState } from 'react-use';

import { Trans, t } from '@grafana/i18n';
import { Divider, Field, Icon, Input, Label, Stack, Switch, Tooltip } from '@grafana/ui';

import { type RuleFormValues } from '../../../types/rule-form';
import { parsePrometheusDuration } from '../../../utils/time';
import { CollapseToggle } from '../../CollapseToggle';
import { DurationQuickPick } from '../DurationQuickPick';
import { GrafanaAlertStatePicker } from '../GrafanaAlertStatePicker';

interface CommonEvaluationFieldsProps {
  existing: boolean;
  isAlertingRule: boolean;
}

const forValidationOptions = (getEvaluateEvery: () => string): RegisterOptions<{ evaluateFor: string }> => ({
  required: {
    value: true,
    message: t('alerting.for-validation-options.message.required', 'Required.'),
  },
  validate: (value) => {
    if (value === '0') {
      return true;
    }
    try {
      const millisFor = parsePrometheusDuration(value);
      if (millisFor === 0) {
        return true;
      }
      try {
        const millisEvery = parsePrometheusDuration(getEvaluateEvery());
        return millisFor >= millisEvery
          ? true
          : t(
              'alerting.rule-form.evaluation-behaviour-for.validation',
              'Pending period must be greater than or equal to the evaluation interval.'
            );
      } catch {
        return true;
      }
    } catch (error) {
      return error instanceof Error
        ? error.message
        : t('alerting.rule-form.evaluation-behaviour-for.error-parsing', 'Failed to parse duration');
    }
  },
});

function PendingPeriodInput({ evaluateEvery }: { evaluateEvery: string }) {
  const {
    register,
    formState: { errors },
    setValue,
    getValues,
    watch,
    trigger,
  } = useFormContext<RuleFormValues>();

  const evaluateForId = 'eval-for-input';
  const currentPendingPeriod = watch('evaluateFor');

  const isFirstMount = useFirstMountState();
  useEffect(() => {
    if (isFirstMount) {
      return;
    }
    trigger('evaluateFor');
  }, [evaluateEvery, currentPendingPeriod, trigger, isFirstMount]);

  const setPendingPeriod = (pendingPeriod: string) => {
    setValue('evaluateFor', pendingPeriod);
  };

  return (
    <Stack direction="column" gap={2}>
      <Field
        noMargin
        label={
          <Label
            htmlFor={evaluateForId}
            description={t(
              'alerting.for-input.description-pending',
              'Period during which the threshold condition must be met to trigger an alert. Selecting "None" triggers the alert immediately once the condition is met.'
            )}
          >
            <Trans i18nKey="alerting.rule-form.evaluation-behaviour.pending-period">Pending period</Trans>
          </Label>
        }
        error={errors.evaluateFor?.message}
        invalid={Boolean(errors.evaluateFor?.message) ? true : undefined}
        validationMessageHorizontalOverflow={true}
      >
        <Input
          id={evaluateForId}
          width={8}
          {...register(
            'evaluateFor',
            forValidationOptions(() => getValues('evaluateEvery'))
          )}
        />
      </Field>
      <DurationQuickPick
        selectedDuration={currentPendingPeriod}
        groupEvaluationInterval={evaluateEvery}
        onSelect={setPendingPeriod}
      />
    </Stack>
  );
}

function KeepFiringForInput({ evaluateEvery }: { evaluateEvery: string }) {
  const {
    register,
    formState: { errors },
    setValue,
    watch,
  } = useFormContext<RuleFormValues>();

  const currentKeepFiringFor = watch('keepFiringFor');
  const keepFiringForId = 'keep-firing-for-input';

  const setKeepFiringFor = (keepFiringFor: string) => {
    setValue('keepFiringFor', keepFiringFor);
  };

  return (
    <Stack direction="column" gap={2}>
      <Field
        noMargin
        label={
          <Label
            htmlFor={keepFiringForId}
            description={t(
              'alerting.rule-form.evaluation-behaviour.keep-firing-for.label-description',
              'Period during which the alert will continue to show up as firing even though the threshold condition is no longer breached. Selecting "None" means the alert will be back to normal immediately.'
            )}
          >
            <Trans i18nKey="alerting.rule-form.evaluation-behaviour.keep-firing-for.label-text">Keep firing for</Trans>
          </Label>
        }
        error={errors.keepFiringFor?.message}
        invalid={Boolean(errors.keepFiringFor?.message) ? true : undefined}
        validationMessageHorizontalOverflow={true}
      >
        <Input id={keepFiringForId} width={8} {...register('keepFiringFor')} />
      </Field>
      <DurationQuickPick
        selectedDuration={currentKeepFiringFor}
        groupEvaluationInterval={evaluateEvery}
        onSelect={setKeepFiringFor}
      />
    </Stack>
  );
}

export function CommonEvaluationFields({ existing, isAlertingRule }: CommonEvaluationFieldsProps) {
  const [showErrorHandling, setShowErrorHandling] = useState(false);
  const { watch, setValue } = useFormContext<RuleFormValues>();

  const [isPaused, evaluateEvery] = watch(['isPaused', 'evaluateEvery']);

  const pauseContentText = isAlertingRule
    ? t('alerting.rule-form.evaluation.pause.alerting', 'Turn on to pause evaluation for this alert rule.')
    : t('alerting.rule-form.evaluation.pause.recording', 'Turn on to pause evaluation for this recording rule.');

  return (
    <Stack direction="column" gap={2}>
      {isAlertingRule && <PendingPeriodInput evaluateEvery={evaluateEvery} />}
      <Divider />
      {isAlertingRule && <KeepFiringForInput evaluateEvery={evaluateEvery} />}

      {existing && (
        <Field noMargin htmlFor="pause-alert-switch">
          <Controller
            render={() => (
              <Stack gap={1} direction="row" alignItems="center">
                <Switch
                  id="pause-alert"
                  onChange={(value) => {
                    setValue('isPaused', value.currentTarget.checked);
                  }}
                  value={Boolean(isPaused)}
                />
                <label htmlFor="pause-alert">
                  <Trans i18nKey="alerting.rule-form.pause.label">Pause evaluation</Trans>
                  <Tooltip placement="top" content={pauseContentText} theme={'info'}>
                    <Icon tabIndex={0} name="info-circle" size="sm" />
                  </Tooltip>
                </label>
              </Stack>
            )}
            name="isPaused"
          />
        </Field>
      )}

      {isAlertingRule && (
        <>
          <CollapseToggle
            isCollapsed={!showErrorHandling}
            onToggle={(collapsed) => setShowErrorHandling(!collapsed)}
            text={t(
              'alerting.grafana-evaluation-behavior-step.text-configure-no-data-and-error-handling',
              'Configure no data and error handling'
            )}
          />
          {showErrorHandling && (
            <Stack direction="column" gap={2}>
              <Field
                noMargin
                htmlFor="no-data-state-input"
                label={t('alerting.alert.state-no-data', 'Alert state if no data or all values are null')}
              >
                <Controller
                  render={({ field: { onChange, ref, ...field } }) => (
                    <GrafanaAlertStatePicker
                      {...field}
                      inputId="no-data-state-input"
                      width={42}
                      includeNoData={true}
                      includeError={false}
                      onChange={(value) => onChange(value?.value)}
                    />
                  )}
                  name="noDataState"
                />
              </Field>
              <Field
                noMargin
                htmlFor="exec-err-state-input"
                label={t('alerting.alert.state-error-timeout', 'Alert state if execution error or timeout')}
              >
                <Controller
                  render={({ field: { onChange, ref, ...field } }) => (
                    <GrafanaAlertStatePicker
                      {...field}
                      inputId="exec-err-state-input"
                      width={42}
                      includeNoData={false}
                      includeError={true}
                      onChange={(value) => onChange(value?.value)}
                    />
                  )}
                  name="execErrState"
                />
              </Field>
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
}
