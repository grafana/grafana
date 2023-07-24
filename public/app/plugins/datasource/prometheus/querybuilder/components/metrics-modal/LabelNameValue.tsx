import React from 'react';

import { Checkbox, useTheme2 } from '@grafana/ui/src';

import { getLabelValueLabelStyles } from './MetricsModal';

export const LabelNameValue = (props: {
  labelName: string;
  labelValue: string;
  onChange: React.FormEventHandler<HTMLInputElement>;
  checked: boolean;
}) => {
  const { labelValue, onChange, checked } = props;
  const theme = useTheme2();
  const styles = getLabelValueLabelStyles(theme);
  return (
    <div className={styles.labelName}>
      <Checkbox onChange={onChange} label={labelValue} checked={checked} />
    </div>
  );
};
