import React from 'react';
import { KubernetesClusterActions } from '../KubernetesClusterActions/KubernetesClusterActions';
import { Kubernetes } from '../Kubernetes.types';

export const clusterActionsRender = ({
  setSelectedCluster,
  setDeleteModalVisible,
  setViewConfigModalVisible,
  getDBClusters,
}: Omit<any, 'dbCluster'>) => (kubernetesCluster: Kubernetes) => (
  <KubernetesClusterActions
    kubernetesCluster={kubernetesCluster}
    setSelectedCluster={setSelectedCluster}
    setDeleteModalVisible={setDeleteModalVisible}
    setViewConfigModalVisible={setViewConfigModalVisible}
    getDBClusters={getDBClusters}
  />
);
