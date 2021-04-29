import React, { FC, useState } from 'react';
import { Field, Input, Select, useStyles, InputControl, InlineLabel, Switch } from '@grafana/ui';
import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { RuleEditorSection } from './RuleEditorSection';
import { useFormContext, RegisterOptions } from 'react-hook-form';
import { RuleFormType, RuleFormValues, TimeOptions } from '../../types/rule-form';
import { ConditionField } from './ConditionField';
import { GrafanaAlertStatePicker } from './GrafanaAlertStatePicker';

const timeRangeValidationOptions: RegisterOptions = {
  required: {
    value: true,
    message: 'Required.',
  },
  pattern: {
    value: new RegExp(`^\\d+(${Object.values(TimeOptions).join('|')})$`),
    message: `Must be of format "(number)(unit)", for example "1m". Available units: ${Object.values(TimeOptions).join(
      ', '
    )}`,
  },
};

const timeOptions = Object.entries(TimeOptions).map(([key, value]) => ({
  label: key[0].toUpperCase() + key.slice(1),
  value: value,
}));

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
      {type === RuleFormType.threshold && (
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
                    <GrafanaAlertStatePicker {...field} width={42} onChange={(value) => onChange(value?.value)} />
                  )}
                  name="noDataState"
                />
              </Field>
              <Field label="Alert state if execution error or timeout">
                <InputControl
                  render={({ field: { onChange, ref, ...field } }) => (
                    <GrafanaAlertStatePicker {...field} width={42} onChange={(value) => onChange(value?.value)} />
                  )}
                  name="execErrState"
                />
              </Field>
            </>
          )}
        </>
      )}
      {type === RuleFormType.system && (
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
