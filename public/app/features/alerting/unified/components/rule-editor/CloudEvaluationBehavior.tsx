import { css } from '@emotion/css';
import React from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Field, Input, InputControl, Select, useStyles2 } from '@grafana/ui';

import { RuleFormType, RuleFormValues } from '../../types/rule-form';
import { timeOptions } from '../../utils/time';

import { GroupAndNamespaceFields } from './GroupAndNamespaceFields';
import { PreviewRule } from './PreviewRule';
import { RuleEditorSection } from './RuleEditorSection';

export const CloudEvaluationBehavior = () => {
  const styles = useStyles2(getStyles);
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = useFormContext<RuleFormValues>();

  const type = watch('type');
  const dataSourceName = watch('dataSourceName');

  return (
    <RuleEditorSection stepNo={3} title="Set alert evaluation behavior">
      <Field
        label="Pending period"
        description="Period in which an alert rule can be in breach of the condition until the alert rule fires."
      >
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
      {type === RuleFormType.cloudAlerting && dataSourceName && (
        <GroupAndNamespaceFields rulesSourceName={dataSourceName} />
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
  timeUnit: css`
    margin-left: ${theme.spacing(0.5)};
  `,
});
