import React, { FC } from 'react';
import { useStyles } from '@grafana/ui';
import { OPERATOR_FULL_LABELS } from 'app/percona/shared/core';
import { getStyles } from './OperatorStatusItem.styles';
import { OperatorStatusItemProps } from './OperatorStatusItem.types';
import { KubernetesOperatorStatus } from './KubernetesOperatorStatus/KubernetesOperatorStatus';
import { buildOperatorLabel } from './OperatorStatusItem.utils';

export const OperatorStatusItem: FC<OperatorStatusItemProps> = ({
  operator,
  databaseType,
  kubernetes,
  setSelectedCluster,
  setOperatorToUpdate,
  setUpdateOperatorModalVisible,
  dataQa,
}) => {
  const styles = useStyles(getStyles);

  return (
    <div className={styles.connectionItemWrapper} data-qa={dataQa}>
      <span className={styles.connectionItemLabel} title={OPERATOR_FULL_LABELS[databaseType]}>
        {buildOperatorLabel(operator, databaseType)}:
      </span>
      <span className={styles.connectionItemValue}>
        <KubernetesOperatorStatus
          operator={operator}
          databaseType={databaseType}
          kubernetes={kubernetes}
          setSelectedCluster={setSelectedCluster}
          setOperatorToUpdate={setOperatorToUpdate}
          setUpdateOperatorModalVisible={setUpdateOperatorModalVisible}
        />
      </span>
    </div>
  );
};
