import React, { FC } from 'react';
import { Field, Input, Select, useStyles, Label, InputControl } from '@grafana/ui';
import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { RuleEditorSection } from './RuleEditorSection';
import { useFormContext } from 'react-hook-form';
import { RuleFormValues } from '../../types/rule-form';

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

const AlertConditionsSection: FC = () => {
  const styles = useStyles(getStyles);
  const { register, control } = useFormContext<RuleFormValues>();
  return (
    <RuleEditorSection stepNo={3} title="Define alert conditions">
      <Label description="Required time for which the expression has to happen">For</Label>
      <div className={styles.flexRow}>
        <Field className={styles.numberInput}>
          <Input ref={register()} name="forTime" />
        </Field>
        <Field className={styles.numberInput}>
          <InputControl name="timeUnit" as={Select} options={timeOptions} control={control} />
        </Field>
      </div>
    </RuleEditorSection>
  );
};

export default AlertConditionsSection;
