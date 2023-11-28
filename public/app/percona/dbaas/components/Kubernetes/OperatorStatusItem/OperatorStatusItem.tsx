import React, { FC } from 'react';

import { useStyles } from '@grafana/ui';
import { OPERATOR_FULL_LABELS } from 'app/percona/shared/core';

import { KubernetesClusterStatus } from '../KubernetesClusterStatus/KubernetesClusterStatus.types';

import { KubernetesOperatorStatus } from './KubernetesOperatorStatus/KubernetesOperatorStatus';
import { KubernetesOperatorStatus as Status } from './KubernetesOperatorStatus/KubernetesOperatorStatus.types';
import { getStyles } from './OperatorStatusItem.styles';
import { OperatorStatusItemProps } from './OperatorStatusItem.types';
import { buildOperatorLabel } from './OperatorStatusItem.utils';

export const OperatorStatusItem: FC<React.PropsWithChildren<OperatorStatusItemProps>> = ({
  operator,
  databaseType,
  kubernetes,
  setSelectedCluster,
  setOperatorToUpdate,
  setUpdateOperatorModalVisible,
  dataTestId,
}) => {
  const styles = useStyles(getStyles);

  const showStatus = !(
    kubernetes.status === KubernetesClusterStatus.provisioning && operator.status === Status.unavailable
  );

  return (
    <div className={styles.connectionItemWrapper} data-testid={dataTestId}>
      <span className={styles.connectionItemLabel} title={OPERATOR_FULL_LABELS[databaseType]}>
        {buildOperatorLabel(operator, databaseType)}
        {showStatus ? ':' : ''}
      </span>
      {showStatus && (
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
      )}
    </div>
  );
};
