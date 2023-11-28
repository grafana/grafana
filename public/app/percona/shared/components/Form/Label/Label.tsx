import React, { FC } from 'react';

import { useStyles } from '@grafana/ui';

import { getStyles } from './Label.styles';
import { LabelProps } from './Label.types';

export const Label: FC<React.PropsWithChildren<LabelProps>> = ({ label, dataTestId }) => {
  const styles = useStyles(getStyles);

  return (
    <label className={styles.label} data-testid={dataTestId}>
      {label}
    </label>
  );
};
