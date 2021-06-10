import React, { FC, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme, parseDuration, addDurationToDate } from '@grafana/data';
import { Field, InlineLabel, Input, InputControl, Select, Switch, useStyles } from '@grafana/ui';
import { useFormContext, RegisterOptions } from 'react-hook-form';
import { RuleFormType, RuleFormValues } from '../../types/rule-form';
import { timeOptions, timeValidationPattern } from '../../utils/time';
import { ConditionField } from './ConditionField';
import { GrafanaAlertStatePicker } from './GrafanaAlertStatePicker';
import { RuleEditorSection } from './RuleEditorSection';
import { PreviewRule } from './PreviewRule';

const MIN_TIME_RANGE_STEP_S = 10; // 10 seconds

const timeRangeValidationOptions: RegisterOptions = {
  required: {
    value: true,
    message: 'Required.',
  },
  pattern: timeValidationPattern,
  validate: (value: string) => {
    const duration = parseDuration(value);
    if (Object.keys(duration).length) {
      const from = new Date();
      const to = addDurationToDate(from, duration);
      const diff = to.getTime() - from.getTime();
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

export const ConditionsStep: FC = () => {
  const styles = useStyles(getStyles);
  const [showErrorHandling, setShowErrorHandling] = useState(false);
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = useFormContext<RuleFormValues>();

  const type = watch('type');

  return (
    <RuleEditorSection stepNo={3} title="Define alert conditions">
      {type === RuleFormType.grafana && (
        <>
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
                <Input width={8} {...register('evaluateEvery', timeRangeValidationOptions)} />
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
                <Input width={8} {...register('evaluateFor', timeRangeValidationOptions)} />
              </Field>
            </div>
          </Field>
          <Field label="Configure no data and error handling" horizontal={true} className={styles.switchField}>
            <Switch value={showErrorHandling} onChange={() => setShowErrorHandling(!showErrorHandling)} />
          </Field>
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
        </>
      )}
      {type === RuleFormType.cloud && (
        <>
          <Field label="For" description="Expression has to be true for this long for the alert to be fired.">
            <div className={styles.flexRow}>
              <Field invalid={!!errors.forTime?.message} error={errors.forTime?.message} className={styles.inlineField}>
                <Input
                  {...register('forTime', { pattern: { value: /^\d+$/, message: 'Must be a postive integer.' } })}
                  width={8}
                />
              </Field>
              <InputControl
                name="forTimeUnit"
                render={({ field: { onChange, ref, ...field } }) => (
                  <Select
                    {...field}
                    options={timeOptions}
                    onChange={(value) => onChange(value?.value)}
                    width={15}
                    className={styles.timeUnit}
                  />
                )}
                control={control}
              />
            </div>
          </Field>
        </>
      )}
      <PreviewRule />
    </RuleEditorSection>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  inlineField: css`
    margin-bottom: 0;
  `,
  flexRow: css`
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    align-items: flex-start;
  `,
  numberInput: css`
    width: 200px;
    & + & {
      margin-left: ${theme.spacing.sm};
    }
  `,
  timeUnit: css`
    margin-left: ${theme.spacing.xs};
  `,
  switchField: css`
    display: inline-flex;
    flex-direction: row-reverse;
    margin-top: ${theme.spacing.md};
    & > div:first-child {
      margin-left: ${theme.spacing.sm};
    }
  `,
});
