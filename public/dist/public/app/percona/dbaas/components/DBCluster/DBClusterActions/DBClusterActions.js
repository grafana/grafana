import { __awaiter } from "tslib";
import React, { useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { MultipleActions } from 'app/percona/dbaas/components/MultipleActions/MultipleActions';
import { logger } from 'app/percona/shared/helpers/logger';
import { useDispatch } from 'app/types';
import { selectDBCluster } from '../../../../shared/core/reducers/dbaas/dbaas';
import { DBClusterStatus } from '../DBCluster.types';
import { isClusterChanging, newDBClusterService } from '../DBCluster.utils';
import { DB_CLUSTER_EDIT_URL } from '../EditDBClusterPage/EditDBClusterPage.constants';
import { styles } from './DBClusterActions.styles';
export const DBClusterActions = ({ dbCluster, setDeleteModalVisible, setLogsModalVisible, setUpdateModalVisible, getDBClusters, }) => {
    const history = useHistory();
    const dispatch = useDispatch();
    const getActions = useCallback((dbCluster) => [
        {
            content: Messages.dbcluster.table.actions.updateCluster,
            disabled: !dbCluster.availableImage ||
                dbCluster.status === DBClusterStatus.upgrading ||
                dbCluster.status === DBClusterStatus.deleting ||
                dbCluster.status === DBClusterStatus.changing ||
                dbCluster.status === DBClusterStatus.suspended,
            action: () => {
                dispatch(selectDBCluster(dbCluster));
                setUpdateModalVisible(true);
            },
        },
        {
            content: Messages.dbcluster.table.actions.deleteCluster,
            disabled: dbCluster.status === DBClusterStatus.deleting,
            action: () => {
                dispatch(selectDBCluster(dbCluster));
                setDeleteModalVisible(true);
            },
        },
        {
            content: Messages.dbcluster.table.actions.editCluster,
            disabled: dbCluster.status !== DBClusterStatus.ready,
            action: () => {
                dispatch(selectDBCluster(dbCluster));
                history.push(DB_CLUSTER_EDIT_URL);
            },
        },
        {
            content: Messages.dbcluster.table.actions.restartCluster,
            disabled: isClusterChanging(dbCluster) || dbCluster.status === DBClusterStatus.suspended,
            action: () => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const dbClusterService = newDBClusterService(dbCluster.databaseType);
                    yield dbClusterService.restartDBCluster(dbCluster);
                    getDBClusters();
                }
                catch (e) {
                    logger.error(e);
                }
            }),
        },
        {
            content: dbCluster.status === DBClusterStatus.ready
                ? Messages.dbcluster.table.actions.suspend
                : Messages.dbcluster.table.actions.resume,
            disabled: dbCluster.status !== DBClusterStatus.ready && dbCluster.status !== DBClusterStatus.suspended,
            action: () => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const dbClusterService = newDBClusterService(dbCluster.databaseType);
                    if (dbCluster.status === DBClusterStatus.ready) {
                        yield dbClusterService.suspendDBCluster(dbCluster);
                    }
                    else {
                        yield dbClusterService.resumeDBCluster(dbCluster);
                    }
                    getDBClusters();
                }
                catch (e) {
                    logger.error(e);
                }
            }),
        },
        {
            content: Messages.dbcluster.table.actions.logs,
            disabled: dbCluster.status === DBClusterStatus.suspended,
            action: () => {
                dispatch(selectDBCluster(dbCluster));
                setLogsModalVisible(true);
            },
        },
    ], 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setUpdateModalVisible, setDeleteModalVisible, getDBClusters, setLogsModalVisible]);
    return (React.createElement("div", { className: styles.actionsColumn },
        React.createElement(MultipleActions, { actions: getActions(dbCluster), "data-testid": "dbcluster-actions" })));
};
//# sourceMappingURL=DBClusterActions.js.map