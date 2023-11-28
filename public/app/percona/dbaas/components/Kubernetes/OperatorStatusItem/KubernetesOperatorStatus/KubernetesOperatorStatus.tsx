/* eslint-disable react/display-name */
import React, { FC } from 'react';

import { Button, useStyles } from '@grafana/ui';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { OPERATOR_LABELS } from 'app/percona/shared/core';

import { DATABASE_COMPONENT_TO_UPDATE_MAP } from '../../Kubernetes.constants';

import { getStyles } from './KubernetesOperatorStatus.styles';
import { KubernetesOperatorStatus as Status, KubernetesOperatorStatusProps } from './KubernetesOperatorStatus.types';
import { getStatusLink } from './KubernetesOperatorStatus.utils';
import { OperatorStatus } from './OperatorStatus/OperatorStatus';

export const KubernetesOperatorStatus: FC<React.PropsWithChildren<KubernetesOperatorStatusProps>> = ({
  operator,
  databaseType,
  kubernetes,
  setSelectedCluster,
  setOperatorToUpdate,
  setUpdateOperatorModalVisible,
}) => {
  const styles = useStyles(getStyles);
  const { status, availableVersion } = operator;
  const isVersionAvailable = (status === Status.ok || status === Status.unsupported) && !!availableVersion;
  const showLink = status === Status.unavailable || isVersionAvailable;
  const updateOperator = () => {
    setSelectedCluster(kubernetes);
    setOperatorToUpdate({
      operatorType: DATABASE_COMPONENT_TO_UPDATE_MAP[databaseType]!,
      operatorTypeLabel: OPERATOR_LABELS[databaseType],
      ...operator,
    });
    setUpdateOperatorModalVisible(true);
  };

  return (
    <div className={styles.clusterStatusWrapper}>
      {showLink ? (
        <a
          href={getStatusLink(status, databaseType, availableVersion)}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="cluster-link"
        >
          <OperatorStatus operator={operator} />
        </a>
      ) : (
        <OperatorStatus operator={operator} />
      )}
      {isVersionAvailable && (
        <Button data-testid="update-operator-button" size="md" onClick={updateOperator} icon="upload" fill="text">
          {Messages.kubernetes.updateOperator}
        </Button>
      )}
    </div>
  );
};
