import React, { FC } from 'react';

import { useStyles } from '@grafana/ui';

import { getStyles } from './DBClusterConnectionItem.styles';
import { DBClusterConnectionItemProps } from './DBClusterConnectionItem.types';

export const DBClusterConnectionItem: FC<React.PropsWithChildren<DBClusterConnectionItemProps>> = ({ label, value, dataTestId }) => {
  const styles = useStyles(getStyles);

  return (
    <div className={styles.connectionItemWrapper} data-testid={dataTestId}>
      <span className={styles.connectionItemLabel}>{label}:</span>
      <span className={styles.connectionItemValue}>{value}</span>
    </div>
  );
};
