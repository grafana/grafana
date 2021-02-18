import React, { FC } from 'react';
import { useStyles } from '@grafana/ui';
import { getStyles } from './DBClusterConnectionItem.styles';
import { DBClusterConnectionItemProps } from './DBClusterConnectionItem.types';

export const DBClusterConnectionItem: FC<DBClusterConnectionItemProps> = ({ label, value, dataQa }) => {
  const styles = useStyles(getStyles);

  return (
    <div className={styles.connectionItemWrapper} data-qa={dataQa}>
      <span className={styles.connectionItemLabel}>{label}:</span>
      <span className={styles.connectionItemValue}>{value}</span>
    </div>
  );
};
