import { logger } from '@percona/platform-core';
import React, { FC, useCallback } from 'react';

import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { MultipleActions } from 'app/percona/dbaas/components/MultipleActions/MultipleActions';

import { DBCluster, DBClusterStatus } from '../DBCluster.types';
import { isClusterChanging, newDBClusterService } from '../DBCluster.utils';

import { styles } from './DBClusterActions.styles';
import { DBClusterActionsProps } from './DBClusterActions.types';

export const DBClusterActions: FC<DBClusterActionsProps> = ({
  dbCluster,
  setSelectedCluster,
  setDeleteModalVisible,
  setEditModalVisible,
  setLogsModalVisible,
  setUpdateModalVisible,
  getDBClusters,
}) => {
  const getActions = useCallback(
    (dbCluster: DBCluster) => [
      {
        content: Messages.dbcluster.table.actions.updateCluster,
        disabled:
          !dbCluster.availableImage ||
          dbCluster.status === DBClusterStatus.upgrading ||
          dbCluster.status === DBClusterStatus.deleting ||
          dbCluster.status === DBClusterStatus.changing ||
          dbCluster.status === DBClusterStatus.suspended,
        action: () => {
          setSelectedCluster(dbCluster);
          setUpdateModalVisible(true);
        },
      },
      {
        content: Messages.dbcluster.table.actions.deleteCluster,
        disabled: dbCluster.status === DBClusterStatus.deleting,
        action: () => {
          setSelectedCluster(dbCluster);
          setDeleteModalVisible(true);
        },
      },
      {
        content: Messages.dbcluster.table.actions.editCluster,
        disabled: dbCluster.status !== DBClusterStatus.ready,
        action: () => {
          setSelectedCluster(dbCluster);
          setEditModalVisible(true);
        },
      },
      {
        content: Messages.dbcluster.table.actions.restartCluster,
        disabled: isClusterChanging(dbCluster) || dbCluster.status === DBClusterStatus.suspended,
        action: async () => {
          try {
            const dbClusterService = newDBClusterService(dbCluster.databaseType);

            await dbClusterService.restartDBCluster(dbCluster);
            getDBClusters();
          } catch (e) {
            logger.error(e);
          }
        },
      },
      {
        content:
          dbCluster.status === DBClusterStatus.ready
            ? Messages.dbcluster.table.actions.suspend
            : Messages.dbcluster.table.actions.resume,
        disabled: dbCluster.status !== DBClusterStatus.ready && dbCluster.status !== DBClusterStatus.suspended,
        action: async () => {
          try {
            const dbClusterService = newDBClusterService(dbCluster.databaseType);

            if (dbCluster.status === DBClusterStatus.ready) {
              await dbClusterService.suspendDBCluster(dbCluster);
            } else {
              await dbClusterService.resumeDBCluster(dbCluster);
            }

            getDBClusters();
          } catch (e) {
            logger.error(e);
          }
        },
      },
      {
        content: Messages.dbcluster.table.actions.logs,
        disabled: dbCluster.status === DBClusterStatus.suspended,
        action: () => {
          setSelectedCluster(dbCluster);
          setLogsModalVisible(true);
        },
      },
    ],
    [
      setSelectedCluster,
      setDeleteModalVisible,
      getDBClusters,
      setEditModalVisible,
      setLogsModalVisible,
      setUpdateModalVisible,
    ]
  );

  return (
    <div className={styles.actionsColumn}>
      <MultipleActions actions={getActions(dbCluster)} dataTestId="dbcluster-actions" />
    </div>
  );
};
