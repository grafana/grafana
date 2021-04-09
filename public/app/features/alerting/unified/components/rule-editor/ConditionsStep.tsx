import React, { FC } from 'react';
import { Field, Input, Select, useStyles, Label, InputControl } from '@grafana/ui';
import { css } from '@emotion/css';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { RuleEditorSection } from './RuleEditorSection';
import { useFormContext } from 'react-hook-form';
import { RuleFormType, RuleFormValues } from '../../types/rule-form';

enum TIME_OPTIONS {
  seconds = 's',
  minutes = 'm',
  hours = 'h',
  days = 'd',
}

const timeOptions = Object.entries(TIME_OPTIONS).map(([key, value]) => ({
  label: key,
  value: value,
}));

const getStyles = (theme: GrafanaTheme) => ({
  flexRow: css`
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    justify-content: flex-start;
  `,
  numberInput: css`
    width: 200px;
    & + & {
      margin-left: ${theme.spacing.sm};
    }
  `,
});

export const ConditionsStep: FC = () => {
  const styles = useStyles(getStyles);
  const { register, control, watch } = useFormContext<RuleFormValues>();

  const type = watch('type');

  return (
    <RuleEditorSection stepNo={3} title="Define alert conditions">
      <Label description="Required time for which the expression has to happen">For</Label>
      {type === RuleFormType.system && (
        <div className={styles.flexRow}>
          <Field className={styles.numberInput}>
            <Input ref={register()} name="forTime" />
          </Field>
          <Field className={styles.numberInput}>
            <InputControl
              name="forTimeUnit"
              as={Select}
              options={timeOptions}
              control={control}
              onChange={(val: SelectableValue) => val.value}
            />
          </Field>
        </div>
      )}
    </RuleEditorSection>
  );
};
