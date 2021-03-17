import React, { FC, useState } from 'react';
import { Field, FieldSet, Input, Select, useStyles, Label } from '@grafana/ui';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

type Props = {};

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

const AlertConditionsSection: FC<Props> = (props) => {
  const styles = useStyles(getStyles);
  const [timeValue, setTimeValue] = useState<string>();
  return (
    <FieldSet label="Define alert conditions">
      <Label description="Required time for which the expression has to happen">For</Label>
      <div className={styles.flexRow}>
        <Field className={styles.numberInput}>
          <Input name="for" />
        </Field>
        <Field className={styles.numberInput}>
          <Select value={timeValue} onChange={({ value }) => setTimeValue(value)} options={timeOptions} />
        </Field>
      </div>
    </FieldSet>
  );
};

export default AlertConditionsSection;
