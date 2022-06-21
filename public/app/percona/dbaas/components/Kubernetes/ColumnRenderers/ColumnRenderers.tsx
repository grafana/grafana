/* eslint-disable react/display-name */
import React from 'react';

import { Kubernetes } from '../Kubernetes.types';
import { KubernetesClusterActions } from '../KubernetesClusterActions/KubernetesClusterActions';

export const clusterActionsRender =
  ({
    setSelectedCluster,
    setDeleteModalVisible,
    setViewConfigModalVisible,
    setManageComponentsModalVisible,
    getDBClusters,
  }: Omit<any, 'dbCluster'>) =>
  (kubernetesCluster: Kubernetes) =>
    (
      <KubernetesClusterActions
        kubernetesCluster={kubernetesCluster}
        setSelectedCluster={setSelectedCluster}
        setDeleteModalVisible={setDeleteModalVisible}
        setViewConfigModalVisible={setViewConfigModalVisible}
        setManageComponentsModalVisible={setManageComponentsModalVisible}
        getDBClusters={getDBClusters}
      />
    );
