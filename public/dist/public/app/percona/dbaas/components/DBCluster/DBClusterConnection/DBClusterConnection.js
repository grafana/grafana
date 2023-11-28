import { __awaiter } from "tslib";
/*  eslint-disable @typescript-eslint/consistent-type-assertions */
import React, { useEffect, useState } from 'react';
import { Spinner, useStyles } from '@grafana/ui';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { logger } from 'app/percona/shared/helpers/logger';
import { DBClusterStatus } from '../DBCluster.types';
import { newDBClusterService } from '../DBCluster.utils';
import { INITIAL_CONNECTION } from './DBClusterConnection.constants';
import { getStyles } from './DBClusterConnection.styles';
import { DBClusterConnectionItem } from './DBClusterConnectionItem/DBClusterConnectionItem';
import { DBClusterConnectionPassword } from './DBClusterConnectionPassword/DBClusterConnectionPassword';
export const DBClusterConnection = ({ dbCluster }) => {
    const styles = useStyles(getStyles);
    const [loading, setLoading] = useState(true);
    const [connection, setConnection] = useState(INITIAL_CONNECTION);
    const { host, password, port, username } = connection;
    const { status, databaseType } = dbCluster;
    const isClusterReady = status && status === DBClusterStatus.ready;
    useEffect(() => {
        const getClusterConnection = () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                setLoading(true);
                const dbClusterService = newDBClusterService(databaseType);
                const connection = yield dbClusterService.getDBClusterCredentials(dbCluster);
                if (connection) {
                    setConnection(connection.connection_credentials);
                }
            }
            catch (e) {
                logger.error(e);
            }
            finally {
                setLoading(false);
            }
        });
        if (isClusterReady) {
            getClusterConnection();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status]);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: styles.connectionWrapper },
            !loading && isClusterReady && (React.createElement(React.Fragment, null,
                React.createElement(DBClusterConnectionItem, { label: Messages.dbcluster.table.connection.host, value: host, dataTestId: "cluster-connection-host" }),
                React.createElement(DBClusterConnectionItem, { label: Messages.dbcluster.table.connection.port, value: port, dataTestId: "cluster-connection-port" }),
                React.createElement(DBClusterConnectionItem, { label: Messages.dbcluster.table.connection.username, value: username, dataTestId: "cluster-connection-username" }),
                React.createElement(DBClusterConnectionPassword, { label: Messages.dbcluster.table.connection.password, password: password, dataTestId: "cluster-connection-password" }))),
            loading && status !== DBClusterStatus.suspended && React.createElement(Spinner, null))));
};
//# sourceMappingURL=DBClusterConnection.js.map