import React from 'react';
import { DATABASE_LABELS } from 'app/percona/shared/core';
import { DBClusterConnection } from '../DBClusterConnection/DBClusterConnection';
import { DBClusterStatus } from '../DBClusterStatus/DBClusterStatus';
import { DBCluster } from '../DBCluster.types';
import { DBClusterParameters } from '../DBClusterParameters/DBClusterParameters';
import { DBClusterName } from '../DBClusterName/DBClusterName';
import { DBClusterActions } from '../DBClusterActions/DBClusterActions';
import { DBClusterActionsProps } from '../DBClusterActions/DBClusterActions.types';
import { DBClusterStatusProps } from './ColumnRenderers.types';
import { formatDBClusterVersion } from '../DBCluster.utils';

export const clusterNameRender = (dbCluster: DBCluster) => <DBClusterName dbCluster={dbCluster} />;

export const databaseTypeRender = (dbCluster: DBCluster) =>
  `${DATABASE_LABELS[dbCluster.databaseType]} ${formatDBClusterVersion(dbCluster.installedImage)}`;

export const clusterStatusRender = ({ setSelectedCluster, setLogsModalVisible }: DBClusterStatusProps) => (
  dbCluster: DBCluster
) => (
  <DBClusterStatus
    dbCluster={dbCluster}
    setSelectedCluster={setSelectedCluster}
    setLogsModalVisible={setLogsModalVisible}
  />
);

export const connectionRender = (dbCluster: DBCluster) => <DBClusterConnection dbCluster={dbCluster} />;
export const parametersRender = (dbCluster: DBCluster) => <DBClusterParameters dbCluster={dbCluster} />;

export const clusterActionsRender = ({
  setSelectedCluster,
  setDeleteModalVisible,
  setEditModalVisible,
  setLogsModalVisible,
  setUpdateModalVisible,
  getDBClusters,
}: Omit<DBClusterActionsProps, 'dbCluster'>) => (dbCluster: DBCluster) => (
  <DBClusterActions
    dbCluster={dbCluster}
    setSelectedCluster={setSelectedCluster}
    setDeleteModalVisible={setDeleteModalVisible}
    setEditModalVisible={setEditModalVisible}
    setLogsModalVisible={setLogsModalVisible}
    setUpdateModalVisible={setUpdateModalVisible}
    getDBClusters={getDBClusters}
  />
);
