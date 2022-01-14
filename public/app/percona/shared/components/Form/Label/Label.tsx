import React, { FC } from 'react';

import { useStyles } from '@grafana/ui';

import { getStyles } from './Label.styles';
import { LabelProps } from './Label.types';

export const Label: FC<LabelProps> = ({ label, dataQa }) => {
  const styles = useStyles(getStyles);

  return (
    <label className={styles.label} data-qa={dataQa}>
      {label}
    </label>
  );
};
