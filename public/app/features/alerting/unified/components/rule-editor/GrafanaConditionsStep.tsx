import React, { FC, useState } from 'react';
import { css } from '@emotion/css';
import { parseDuration, durationToMilliseconds, GrafanaTheme2 } from '@grafana/data';
import { Field, InlineLabel, Input, InputControl, useStyles2 } from '@grafana/ui';
import { useFormContext, RegisterOptions } from 'react-hook-form';
import { RuleFormValues } from '../../types/rule-form';
import { positiveDurationValidationPattern, durationValidationPattern } from '../../utils/time';
import { ConditionField } from './ConditionField';
import { GrafanaAlertStatePicker } from './GrafanaAlertStatePicker';
import { RuleEditorSection } from './RuleEditorSection';
import { PreviewRule } from './PreviewRule';
import { GrafanaConditionEvalWarning } from './GrafanaConditionEvalWarning';
import { CollapseToggle } from '../CollapseToggle';

const MIN_TIME_RANGE_STEP_S = 10; // 10 seconds

const forValidationOptions: RegisterOptions = {
  required: {
    value: true,
    message: 'Required.',
  },
  pattern: durationValidationPattern,
};

const evaluateEveryValidationOptions: RegisterOptions = {
  required: {
    value: true,
    message: 'Required.',
  },
  pattern: positiveDurationValidationPattern,
  validate: (value: string) => {
    const duration = parseDuration(value);
    if (Object.keys(duration).length) {
      const diff = durationToMilliseconds(duration);
      if (diff < MIN_TIME_RANGE_STEP_S * 1000) {
        return `Cannot be less than ${MIN_TIME_RANGE_STEP_S} seconds.`;
      }
      if (diff % (MIN_TIME_RANGE_STEP_S * 1000) !== 0) {
        return `Must be a multiple of ${MIN_TIME_RANGE_STEP_S} seconds.`;
      }
    }
    return true;
  },
};

export const GrafanaConditionsStep: FC = () => {
  const styles = useStyles2(getStyles);
  const [showErrorHandling, setShowErrorHandling] = useState(false);
  const {
    register,
    formState: { errors },
  } = useFormContext<RuleFormValues>();

  return (
    <RuleEditorSection stepNo={3} title="Define alert conditions">
      <ConditionField />
      <Field label="Evaluate">
        <div className={styles.flexRow}>
          <InlineLabel width={16} tooltip="How often the alert will be evaluated to see if it fires">
            Evaluate every
          </InlineLabel>
          <Field
            className={styles.inlineField}
            error={errors.evaluateEvery?.message}
            invalid={!!errors.evaluateEvery?.message}
            validationMessageHorizontalOverflow={true}
          >
            <Input width={8} {...register('evaluateEvery', evaluateEveryValidationOptions)} />
          </Field>
          <InlineLabel
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
            <Input width={8} {...register('evaluateFor', forValidationOptions)} />
          </Field>
        </div>
      </Field>
      <GrafanaConditionEvalWarning />
      <CollapseToggle
        isCollapsed={!showErrorHandling}
        onToggle={(collapsed) => setShowErrorHandling(!collapsed)}
        text="Configure no data and error handling"
        className={styles.collapseToggle}
      />
      {showErrorHandling && (
        <>
          <Field label="Alert state if no data or all values are null">
            <InputControl
              render={({ field: { onChange, ref, ...field } }) => (
                <GrafanaAlertStatePicker
                  {...field}
                  width={42}
                  includeNoData={true}
                  onChange={(value) => onChange(value?.value)}
                />
              )}
              name="noDataState"
            />
          </Field>
          <Field label="Alert state if execution error or timeout">
            <InputControl
              render={({ field: { onChange, ref, ...field } }) => (
                <GrafanaAlertStatePicker
                  {...field}
                  width={42}
                  includeNoData={false}
                  onChange={(value) => onChange(value?.value)}
                />
              )}
              name="execErrState"
            />
          </Field>
        </>
      )}
      <PreviewRule />
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
});
