import { css } from '@emotion/css';
import React, { useState } from 'react';
import { RegisterOptions, useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Field, InlineLabel, Input, InputControl, useStyles2 } from '@grafana/ui';

import { RuleFormValues } from '../../types/rule-form';
import { checkEvaluationIntervalGlobalLimit } from '../../utils/config';
import { parsePrometheusDuration } from '../../utils/time';
import { CollapseToggle } from '../CollapseToggle';
import { EvaluationIntervalLimitExceeded } from '../InvalidIntervalWarning';

import { GrafanaAlertStatePicker } from './GrafanaAlertStatePicker';
import { RuleEditorSection } from './RuleEditorSection';

export const MIN_TIME_RANGE_STEP_S = 10; // 10 seconds

export const forValidationOptions = (evaluateEvery: string): RegisterOptions => ({
  required: {
    value: true,
    message: 'Required.',
  },
  validate: (value: string) => {
    // parsePrometheusDuration does not allow 0 but does allow 0s
    if (value === '0') {
      return true;
    }

    try {
      const millisFor = parsePrometheusDuration(value);

      // 0 is a special value meaning for equals evaluation interval
      if (millisFor === 0) {
        return true;
      }

      try {
        const millisEvery = parsePrometheusDuration(evaluateEvery);
        return millisFor >= millisEvery
          ? true
          : 'For duration must be greater than or equal to the evaluation interval.';
      } catch (err) {
        // if we fail to parse "every", assume validation is successful, or the error messages
        // will overlap in the UI
        return true;
      }
    } catch (error) {
      return error instanceof Error ? error.message : 'Failed to parse duration';
    }
  },
});

export const evaluateEveryValidationOptions: RegisterOptions = {
  required: {
    value: true,
    message: 'Required.',
  },
  validate: (value: string) => {
    try {
      const duration = parsePrometheusDuration(value);

      if (duration < MIN_TIME_RANGE_STEP_S * 1000) {
        return `Cannot be less than ${MIN_TIME_RANGE_STEP_S} seconds.`;
      }

      if (duration % (MIN_TIME_RANGE_STEP_S * 1000) !== 0) {
        return `Must be a multiple of ${MIN_TIME_RANGE_STEP_S} seconds.`;
      }

      return true;
    } catch (error) {
      return error instanceof Error ? error.message : 'Failed to parse duration';
    }
  },
};

export const GrafanaEvaluationBehavior = () => {
  const styles = useStyles2(getStyles);
  const [showErrorHandling, setShowErrorHandling] = useState(false);
  const {
    register,
    formState: { errors },
    watch,
  } = useFormContext<RuleFormValues>();

  const { exceedsLimit: exceedsGlobalEvaluationLimit } = checkEvaluationIntervalGlobalLimit(watch('evaluateEvery'));

  const evaluateEveryId = 'eval-every-input';
  const evaluateForId = 'eval-for-input';

  return (
    // TODO remove "and alert condition" for recording rules
    <RuleEditorSection stepNo={2} title="Alert evaluation behavior">
      <Field
        label="Evaluate"
        description="Evaluation interval applies to every rule within a group. It can overwrite the interval of an existing alert rule."
      >
        <div className={styles.flexRow}>
          <InlineLabel
            htmlFor={evaluateEveryId}
            width={16}
            tooltip="How often the alert will be evaluated to see if it fires"
          >
            Evaluate every
          </InlineLabel>
          <Field
            className={styles.inlineField}
            error={errors.evaluateEvery?.message}
            invalid={!!errors.evaluateEvery}
            validationMessageHorizontalOverflow={true}
          >
            <Input id={evaluateEveryId} width={8} {...register('evaluateEvery', evaluateEveryValidationOptions)} />
          </Field>

          <InlineLabel
            htmlFor={evaluateForId}
            width={7}
            tooltip='Once condition is breached, alert will go into pending state. If it is pending for longer than the "for" value, it will become a firing alert.'
          >
            for
          </InlineLabel>
          <Field
            className={styles.inlineField}
            error={errors.evaluateFor?.message}
            invalid={!!errors.evaluateFor?.message}
            validationMessageHorizontalOverflow={true}
          >
            <Input
              id={evaluateForId}
              width={8}
              {...register('evaluateFor', forValidationOptions(watch('evaluateEvery')))}
            />
          </Field>
        </div>
      </Field>
      {exceedsGlobalEvaluationLimit && <EvaluationIntervalLimitExceeded />}
      <CollapseToggle
        isCollapsed={!showErrorHandling}
        onToggle={(collapsed) => setShowErrorHandling(!collapsed)}
        text="Configure no data and error handling"
        className={styles.collapseToggle}
      />
      {showErrorHandling && (
        <>
          <Field htmlFor="no-data-state-input" label="Alert state if no data or all values are null">
            <InputControl
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
          <Field htmlFor="exec-err-state-input" label="Alert state if execution error or timeout">
            <InputControl
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
        </>
      )}
    </RuleEditorSection>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  inlineField: css`
    margin-bottom: 0;
  `,
  flexRow: css`
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    align-items: flex-start;
  `,
  collapseToggle: css`
    margin: ${theme.spacing(2, 0, 2, -1)};
  `,
  globalLimitValue: css`
    font-weight: ${theme.typography.fontWeightBold};
  `,
});
