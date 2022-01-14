import React, { FC } from 'react';
import { useStyles } from '@grafana/ui';
import { DATABASE_LABELS } from 'app/percona/shared/core';
import { getStyles } from './OperatorStatusItem.styles';
import { DBClusterConnectionItemProps } from './OperatorStatusItem.types';
import { KubernetesOperatorStatus } from './KubernetesOperatorStatus/KubernetesOperatorStatus';

export const OperatorStatusItem: FC<DBClusterConnectionItemProps> = ({ status, databaseType, dataQa }) => {
  const styles = useStyles(getStyles);

  return (
    <div className={styles.connectionItemWrapper} data-qa={dataQa}>
      <span className={styles.connectionItemLabel}>{DATABASE_LABELS[databaseType]}:</span>
      <span className={styles.connectionItemValue}>
        <KubernetesOperatorStatus status={status} databaseType={databaseType} />
      </span>
    </div>
  );
};
