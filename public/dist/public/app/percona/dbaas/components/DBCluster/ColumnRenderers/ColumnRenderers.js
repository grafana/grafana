/* eslint-disable react/display-name */
import React from 'react';
import { DATABASE_LABELS } from 'app/percona/shared/core';
import { formatDBClusterVersion } from '../DBCluster.utils';
import { DBClusterActions } from '../DBClusterActions/DBClusterActions';
import { DBClusterConnection } from '../DBClusterConnection/DBClusterConnection';
import { DBClusterName } from '../DBClusterName/DBClusterName';
import { DBClusterParameters } from '../DBClusterParameters/DBClusterParameters';
import { DBClusterStatus } from '../DBClusterStatus/DBClusterStatus';
export const clusterNameRender = (dbCluster) => React.createElement(DBClusterName, { dbCluster: dbCluster });
export const databaseTypeRender = (dbCluster) => `${DATABASE_LABELS[dbCluster.databaseType]} ${formatDBClusterVersion(dbCluster.installedImage)}`;
export const clusterStatusRender = ({ setLogsModalVisible }) => (dbCluster) => React.createElement(DBClusterStatus, { dbCluster: dbCluster, setLogsModalVisible: setLogsModalVisible });
export const connectionRender = (dbCluster) => React.createElement(DBClusterConnection, { dbCluster: dbCluster });
export const parametersRender = (dbCluster) => React.createElement(DBClusterParameters, { dbCluster: dbCluster });
export const clusterActionsRender = ({ setDeleteModalVisible, setLogsModalVisible, setUpdateModalVisible, getDBClusters, }) => (dbCluster) => (React.createElement(DBClusterActions, { dbCluster: dbCluster, setDeleteModalVisible: setDeleteModalVisible, setLogsModalVisible: setLogsModalVisible, setUpdateModalVisible: setUpdateModalVisible, getDBClusters: getDBClusters }));
//# sourceMappingURL=ColumnRenderers.js.map