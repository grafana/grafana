import React from 'react';
import { Badge, useStyles2 } from '@grafana/ui';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { STATUS_DATA_QA } from './KubernetesClusterStatus.constants';
import { getStyles } from './KubernetesClusterStatus.styles';
import { KubernetesClusterStatusColors } from './KubernetesClusterStatus.types';
export const KubernetesClusterStatus = ({ status }) => {
    const styles = useStyles2(getStyles);
    const statusColor = KubernetesClusterStatusColors[status];
    return (React.createElement("div", { className: styles.clusterStatusWrapper },
        React.createElement(Badge, { text: Messages.kubernetes.kubernetesStatus[status], color: statusColor, "data-testid": `cluster-status-${STATUS_DATA_QA[status]}` })));
};
//# sourceMappingURL=KubernetesClusterStatus.js.map