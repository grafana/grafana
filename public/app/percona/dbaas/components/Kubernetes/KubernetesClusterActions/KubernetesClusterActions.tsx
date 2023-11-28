import React, { FC, useCallback } from 'react';

import { config } from '@grafana/runtime';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { Action, MultipleActions } from 'app/percona/dbaas/components/MultipleActions';

import { Kubernetes } from '../Kubernetes.types';
import { KubernetesClusterStatus } from '../KubernetesClusterStatus/KubernetesClusterStatus.types';
import { hasActiveOperator } from '../OperatorStatusItem/KubernetesOperatorStatus/KubernetesOperatorStatus.utils';

import { styles } from './KubernetesClusterActions.styles';
import { DBClusterActionsProps } from './KubernetesClusterActions.types';
export const KubernetesClusterActions: FC<React.PropsWithChildren<DBClusterActionsProps>> = ({
  kubernetesCluster,
  setSelectedCluster,
  setDeleteModalVisible,
  setViewConfigModalVisible,
  setManageComponentsModalVisible,
}) => {
  const isAdmin = config.bootData.user.isGrafanaAdmin;
  const getActions = useCallback(
    (kubernetesCluster: Kubernetes) => {
      const actions: Action[] = [
        {
          content: Messages.kubernetes.deleteAction,
          action: () => {
            setSelectedCluster(kubernetesCluster);
            setDeleteModalVisible(true);
          },
        },
        {
          content: Messages.kubernetes.showConfiguration,
          disabled: kubernetesCluster.status === KubernetesClusterStatus.provisioning,
          action: () => {
            setSelectedCluster(kubernetesCluster);
            setViewConfigModalVisible(true);
          },
        },
      ];

      if (isAdmin) {
        actions.push({
          content: Messages.kubernetes.manageComponents,
          disabled:
            !hasActiveOperator(kubernetesCluster) || kubernetesCluster.status === KubernetesClusterStatus.provisioning,
          action: () => {
            setSelectedCluster(kubernetesCluster);
            setManageComponentsModalVisible(true);
          },
        });
      }

      return actions;
    },
    [isAdmin, setSelectedCluster, setDeleteModalVisible, setManageComponentsModalVisible, setViewConfigModalVisible]
  );

  return (
    <div className={styles.actionsColumn}>
      <MultipleActions actions={getActions(kubernetesCluster)} dataTestId="dbcluster-actions" />
    </div>
  );
};
