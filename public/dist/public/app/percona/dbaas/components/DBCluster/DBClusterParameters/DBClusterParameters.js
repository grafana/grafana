import React from 'react';
import { useStyles } from '@grafana/ui';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { DBClusterStatus } from '../DBCluster.types';
import { DBClusterConnectionItem } from '../DBClusterConnection/DBClusterConnectionItem/DBClusterConnectionItem';
import { getStyles } from './DBClusterParameters.styles';
export const DBClusterParameters = ({ dbCluster }) => {
    const styles = useStyles(getStyles);
    const { status } = dbCluster;
    const { label: exposeLabel, enabled: exposeEnabled, disabled: exposeDisabled, } = Messages.dbcluster.table.parameters.expose;
    return (React.createElement(React.Fragment, null, status && status === DBClusterStatus.ready && (React.createElement("div", { className: styles.wrapper },
        React.createElement(DBClusterConnectionItem, { label: Messages.dbcluster.table.parameters.clusterName, value: dbCluster.kubernetesClusterName, dataTestId: "cluster-parameters-cluster-name" }),
        React.createElement(DBClusterConnectionItem, { label: Messages.dbcluster.table.parameters.cpu, value: dbCluster.cpu, dataTestId: "cluster-parameters-cpu" }),
        React.createElement(DBClusterConnectionItem, { label: Messages.dbcluster.table.parameters.memory, value: `${dbCluster.memory} GB`, dataTestId: "cluster-parameters-memory" }),
        React.createElement(DBClusterConnectionItem, { label: Messages.dbcluster.table.parameters.disk, value: `${dbCluster.disk} GB`, dataTestId: "cluster-parameters-disk" }),
        React.createElement(DBClusterConnectionItem, { label: exposeLabel, value: dbCluster.expose ? exposeEnabled : exposeDisabled, dataTestId: "cluster-parameters-expose" })))));
};
//# sourceMappingURL=DBClusterParameters.js.map