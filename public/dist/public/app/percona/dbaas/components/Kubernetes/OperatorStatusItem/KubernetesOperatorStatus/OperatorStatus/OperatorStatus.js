import React from 'react';
import { Badge, useStyles2 } from '@grafana/ui';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { KubernetesOperatorStatus as Status, KubernetesOperatorStatusColors } from '../KubernetesOperatorStatus.types';
import { STATUS_DATA_QA } from './OperatorStatus.constants';
import { getStyles } from './OperatorStatus.styles';
const { operatorStatus } = Messages.kubernetes;
export const OperatorStatus = ({ operator }) => {
    const styles = useStyles2(getStyles);
    const { status, availableVersion } = operator;
    const showVersionAvailable = (status === Status.ok || status === Status.unsupported) && !!availableVersion;
    const statusColor = showVersionAvailable ? 'orange' : KubernetesOperatorStatusColors[status];
    const externalLink = status === Status.unavailable || showVersionAvailable;
    return (React.createElement(Badge, { text: React.createElement(React.Fragment, null,
            operatorStatus[status],
            showVersionAvailable && (React.createElement("span", { "data-testid": "operator-version-available", className: styles.versionAvailable }, operatorStatus.getNewVersionAvailable(availableVersion)))), color: statusColor, "data-testid": `cluster-status-${STATUS_DATA_QA[status]}`, icon: externalLink ? 'external-link-alt' : undefined, className: status === Status.unsupported ? styles.wrapperGrey : undefined }));
};
//# sourceMappingURL=OperatorStatus.js.map