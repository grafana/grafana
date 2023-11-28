import React, { useMemo } from 'react';
import { useHistory } from 'react-router-dom';
import { useStyles } from '@grafana/ui/src';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { useDispatch } from 'app/types';
import { Databases } from '../../../../shared/core';
import { selectKubernetesCluster } from '../../../../shared/core/reducers/dbaas/dbaas';
import { AddClusterButton } from '../../AddClusterButton/AddClusterButton';
import { DB_CLUSTER_CREATION_URL } from '../../DBCluster/EditDBClusterPage/EditDBClusterPage.constants';
import { KubernetesClusterStatus } from '../KubernetesClusterStatus/KubernetesClusterStatus.types';
import { KubernetesOperatorStatus } from '../OperatorStatusItem/KubernetesOperatorStatus/KubernetesOperatorStatus.types';
import { OperatorStatusItem } from '../OperatorStatusItem/OperatorStatusItem';
import { getStyles } from './OperatorStatusRow.styles';
export const OperatorStatusRow = ({ element, setSelectedCluster, setOperatorToUpdate, setUpdateOperatorModalVisible, }) => {
    const styles = useStyles(getStyles);
    const history = useHistory();
    const dispatch = useDispatch();
    const isDisabled = useMemo(() => {
        var _a, _b, _c, _d;
        return element.status !== KubernetesClusterStatus.ok ||
            !(((_b = (_a = element === null || element === void 0 ? void 0 : element.operators) === null || _a === void 0 ? void 0 : _a.pxc) === null || _b === void 0 ? void 0 : _b.status) === KubernetesOperatorStatus.ok ||
                ((_d = (_c = element === null || element === void 0 ? void 0 : element.operators) === null || _c === void 0 ? void 0 : _c.psmdb) === null || _d === void 0 ? void 0 : _d.status) === KubernetesOperatorStatus.ok);
    }, [element]);
    return (React.createElement("div", { "data-testid": `${element.kubernetesClusterName}-kubernetes-row-wrapper`, className: styles.operatorRowWrapper },
        React.createElement("div", null,
            React.createElement(OperatorStatusItem, { databaseType: Databases.mysql, operator: element.operators.pxc, kubernetes: element, setSelectedCluster: setSelectedCluster, setOperatorToUpdate: setOperatorToUpdate, setUpdateOperatorModalVisible: setUpdateOperatorModalVisible }),
            React.createElement(OperatorStatusItem, { databaseType: Databases.mongodb, operator: element.operators.psmdb, kubernetes: element, setSelectedCluster: setSelectedCluster, setOperatorToUpdate: setOperatorToUpdate, setUpdateOperatorModalVisible: setUpdateOperatorModalVisible })),
        React.createElement(AddClusterButton, { label: Messages.dbcluster.addAction, action: () => {
                dispatch(selectKubernetesCluster(element));
                history.push(DB_CLUSTER_CREATION_URL);
            }, "data-testid": `${element.kubernetesClusterName}-add-cluster-button`, disabled: isDisabled })));
};
//# sourceMappingURL=OperatorStatusRow.js.map