import React, { FC } from 'react';
import { LabelProps } from './Label.types';
import { getStyles } from './Label.styles';
import { useStyles } from '@grafana/ui';

export const Label: FC<LabelProps> = ({ label, dataQa }) => {
  const styles = useStyles(getStyles);

  return (
    <label className={styles.label} data-qa={dataQa}>
      {label}
    </label>
  );
};
