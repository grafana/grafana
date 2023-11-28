import React, { useCallback } from 'react';
import { config } from '@grafana/runtime';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { MultipleActions } from 'app/percona/dbaas/components/MultipleActions';
import { KubernetesClusterStatus } from '../KubernetesClusterStatus/KubernetesClusterStatus.types';
import { hasActiveOperator } from '../OperatorStatusItem/KubernetesOperatorStatus/KubernetesOperatorStatus.utils';
import { styles } from './KubernetesClusterActions.styles';
export const KubernetesClusterActions = ({ kubernetesCluster, setSelectedCluster, setDeleteModalVisible, setViewConfigModalVisible, setManageComponentsModalVisible, }) => {
    const isAdmin = config.bootData.user.isGrafanaAdmin;
    const getActions = useCallback((kubernetesCluster) => {
        const actions = [
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
                disabled: !hasActiveOperator(kubernetesCluster) || kubernetesCluster.status === KubernetesClusterStatus.provisioning,
                action: () => {
                    setSelectedCluster(kubernetesCluster);
                    setManageComponentsModalVisible(true);
                },
            });
        }
        return actions;
    }, [isAdmin, setSelectedCluster, setDeleteModalVisible, setManageComponentsModalVisible, setViewConfigModalVisible]);
    return (React.createElement("div", { className: styles.actionsColumn },
        React.createElement(MultipleActions, { actions: getActions(kubernetesCluster), dataTestId: "dbcluster-actions" })));
};
//# sourceMappingURL=KubernetesClusterActions.js.map