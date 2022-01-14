import React, { FC } from 'react';
import { useStyles } from '@grafana/ui';
import { OPERATOR_LABELS, OPERATOR_FULL_LABELS } from 'app/percona/shared/core';
import { getStyles } from './OperatorStatusItem.styles';
import { DBClusterConnectionItemProps } from './OperatorStatusItem.types';
import { KubernetesOperatorStatus } from './KubernetesOperatorStatus/KubernetesOperatorStatus';

export const OperatorStatusItem: FC<DBClusterConnectionItemProps> = ({ operator, databaseType, dataQa }) => {
  const styles = useStyles(getStyles);

  return (
    <div className={styles.connectionItemWrapper} data-qa={dataQa}>
      <span className={styles.connectionItemLabel} title={OPERATOR_FULL_LABELS[databaseType]}>
        {OPERATOR_LABELS[databaseType]}:
      </span>
      <span className={styles.connectionItemValue}>
        <KubernetesOperatorStatus operator={operator} databaseType={databaseType} />
      </span>
    </div>
  );
};
