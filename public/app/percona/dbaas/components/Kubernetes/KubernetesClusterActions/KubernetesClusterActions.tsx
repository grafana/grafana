import React, { FC, useCallback } from 'react';
import { config } from '@grafana/runtime';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { MultipleActions, Action } from 'app/percona/dbaas/components/MultipleActions';
import { DBClusterActionsProps } from './KubernetesClusterActions.types';
import { styles } from './KubernetesClusterActions.styles';
import { Kubernetes } from '../Kubernetes.types';
import { hasActiveOperator } from '../OperatorStatusItem/KubernetesOperatorStatus/KubernetesOperatorStatus.utils';

export const KubernetesClusterActions: FC<DBClusterActionsProps> = ({
  kubernetesCluster,
  setSelectedCluster,
  setDeleteModalVisible,
  setViewConfigModalVisible,
  setManageComponentsModalVisible,
  getDBClusters,
}) => {
  const isAdmin = config.bootData.user.isGrafanaAdmin;
  const getActions = useCallback(
    (kubernetesCluster: Kubernetes) => {
      const actions: Action[] = [
        {
          title: Messages.kubernetes.deleteAction,
          action: () => {
            setSelectedCluster(kubernetesCluster);
            setDeleteModalVisible(true);
          },
        },
        {
          title: Messages.kubernetes.showConfiguration,
          action: () => {
            setSelectedCluster(kubernetesCluster);
            setViewConfigModalVisible(true);
          },
        },
      ];

      if (isAdmin) {
        actions.push({
          title: Messages.kubernetes.manageComponents,
          disabled: !hasActiveOperator(kubernetesCluster),
          action: () => {
            setSelectedCluster(kubernetesCluster);
            setManageComponentsModalVisible(true);
          },
        });
      }

      return actions;
    },
    [isAdmin, setSelectedCluster, setDeleteModalVisible, getDBClusters]
  );

  return (
    <div className={styles.actionsColumn}>
      <MultipleActions actions={getActions(kubernetesCluster)} dataQa="dbcluster-actions" />
    </div>
  );
};
