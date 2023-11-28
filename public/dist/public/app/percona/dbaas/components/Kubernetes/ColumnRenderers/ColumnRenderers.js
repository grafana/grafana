/* eslint-disable react/display-name */
import React from 'react';
import { KubernetesClusterActions } from '../KubernetesClusterActions/KubernetesClusterActions';
export const clusterActionsRender = ({ setSelectedCluster, setDeleteModalVisible, setViewConfigModalVisible, setManageComponentsModalVisible, getDBClusters, }) => (kubernetesCluster) => (React.createElement(KubernetesClusterActions, { kubernetesCluster: kubernetesCluster, setSelectedCluster: setSelectedCluster, setDeleteModalVisible: setDeleteModalVisible, setViewConfigModalVisible: setViewConfigModalVisible, setManageComponentsModalVisible: setManageComponentsModalVisible, getDBClusters: getDBClusters }));
//# sourceMappingURL=ColumnRenderers.js.map