/* eslint-disable react/display-name */
import React from 'react';

import { DATABASE_LABELS } from 'app/percona/shared/core';

import { DBCluster } from '../DBCluster.types';
import { formatDBClusterVersion } from '../DBCluster.utils';
import { DBClusterActions } from '../DBClusterActions/DBClusterActions';
import { DBClusterActionsProps } from '../DBClusterActions/DBClusterActions.types';
import { DBClusterConnection } from '../DBClusterConnection/DBClusterConnection';
import { DBClusterName } from '../DBClusterName/DBClusterName';
import { DBClusterParameters } from '../DBClusterParameters/DBClusterParameters';
import { DBClusterStatus } from '../DBClusterStatus/DBClusterStatus';

import { DBClusterStatusProps } from './ColumnRenderers.types';

export const clusterNameRender = (dbCluster: DBCluster) => <DBClusterName dbCluster={dbCluster} />;

export const databaseTypeRender = (dbCluster: DBCluster) =>
  `${DATABASE_LABELS[dbCluster.databaseType]} ${formatDBClusterVersion(dbCluster.installedImage)}`;

export const clusterStatusRender =
  ({ setLogsModalVisible }: DBClusterStatusProps) =>
  (dbCluster: DBCluster) =>
    <DBClusterStatus dbCluster={dbCluster} setLogsModalVisible={setLogsModalVisible} />;

export const connectionRender = (dbCluster: DBCluster) => <DBClusterConnection dbCluster={dbCluster} />;
export const parametersRender = (dbCluster: DBCluster) => <DBClusterParameters dbCluster={dbCluster} />;

export const clusterActionsRender =
  ({
    setDeleteModalVisible,
    setLogsModalVisible,
    setUpdateModalVisible,
    getDBClusters,
  }: Omit<DBClusterActionsProps, 'dbCluster'>) =>
  (dbCluster: DBCluster) =>
    (
      <DBClusterActions
        dbCluster={dbCluster}
        setDeleteModalVisible={setDeleteModalVisible}
        setLogsModalVisible={setLogsModalVisible}
        setUpdateModalVisible={setUpdateModalVisible}
        getDBClusters={getDBClusters}
      />
    );
