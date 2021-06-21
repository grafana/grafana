import React, { FC } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { Field, Input, InputControl, Select, useStyles } from '@grafana/ui';
import { useFormContext } from 'react-hook-form';
import { RuleFormValues } from '../../types/rule-form';
import { timeOptions } from '../../utils/time';
import { RuleEditorSection } from './RuleEditorSection';
import { PreviewRule } from './PreviewRule';

export const CloudConditionsStep: FC = () => {
  const styles = useStyles(getStyles);
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<RuleFormValues>();

  return (
    <RuleEditorSection stepNo={3} title="Define alert conditions">
      <Field label="For" description="Expression has to be true for this long for the alert to be fired.">
        <div className={styles.flexRow}>
          <Field invalid={!!errors.forTime?.message} error={errors.forTime?.message} className={styles.inlineField}>
            <Input
              {...register('forTime', { pattern: { value: /^\d+$/, message: 'Must be a positive integer.' } })}
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
  timeUnit: css`
    margin-left: ${theme.spacing.xs};
  `,
});
