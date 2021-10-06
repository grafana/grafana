import React, { FC, useCallback, useMemo, useState, useEffect } from 'react';
import { useStyles } from '@grafana/ui';
import { Table } from 'app/percona/shared/components/Elements/Table';
import { Settings } from 'app/percona/settings/Settings.types';
import { SettingsService } from 'app/percona/settings/Settings.service';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { AddClusterButton } from '../AddClusterButton/AddClusterButton';
import { getStyles } from './DBCluster.styles';
import { DBCluster as Cluster, DBClusterProps } from './DBCluster.types';
import { AddDBClusterModal } from './AddDBClusterModal/AddDBClusterModal';
import { EditDBClusterModal } from './EditDBClusterModal/EditDBClusterModal';
import { DBClusterLogsModal } from './DBClusterLogsModal/DBClusterLogsModal';
import { useDBClusters } from './DBCluster.hooks';
import {
  clusterStatusRender,
  connectionRender,
  databaseTypeRender,
  parametersRender,
  clusterNameRender,
  clusterActionsRender,
} from './ColumnRenderers/ColumnRenderers';
import { DeleteDBClusterModal } from './DeleteDBClusterModal/DeleteDBClusterModal';
import { logger } from '@percona/platform-core';
import { UpdateDBClusterModal } from './UpdateDBClusterModal/UpdateDBClusterModal';

export const DBCluster: FC<DBClusterProps> = ({ kubernetes }) => {
  const styles = useStyles(getStyles);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [logsModalVisible, setLogsModalVisible] = useState(false);
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<Cluster>();
  const [dbClusters, getDBClusters, setLoading, loading] = useDBClusters(kubernetes);
  const [settings, setSettings] = useState<Settings>();
  const [settingsLoading, setSettingsLoading] = useState(true);

  const columns = useMemo(
    () => [
      {
        Header: Messages.dbcluster.table.nameColumn,
        accessor: clusterNameRender,
      },
      {
        Header: Messages.dbcluster.table.databaseTypeColumn,
        accessor: databaseTypeRender,
      },
      {
        Header: Messages.dbcluster.table.connectionColumn,
        accessor: connectionRender,
      },
      {
        Header: Messages.dbcluster.table.clusterParametersColumn,
        accessor: parametersRender,
      },
      {
        Header: Messages.dbcluster.table.clusterStatusColumn,
        accessor: clusterStatusRender({
          setSelectedCluster,
          setLogsModalVisible,
        }),
      },
      {
        Header: Messages.dbcluster.table.actionsColumn,
        accessor: clusterActionsRender({
          setSelectedCluster,
          setDeleteModalVisible,
          setEditModalVisible,
          setLogsModalVisible,
          setUpdateModalVisible,
          getDBClusters,
        }),
      },
    ],
    [setSelectedCluster, setDeleteModalVisible, getDBClusters]
  );

  const AddNewClusterButton = useCallback(
    () => (
      <AddClusterButton
        label={Messages.dbcluster.addAction}
        action={() => setAddModalVisible(!addModalVisible)}
        data-testid="dbcluster-add-cluster-button"
      />
    ),
    [addModalVisible, settings]
  );

  const getRowKey = useCallback(({ original }) => `${original.kubernetesClusterName}${original.clusterName}`, []);

  const getSettings = async () => {
    try {
      setSettingsLoading(true);
      const settings = await SettingsService.getSettings();
      setSettings(settings);
    } catch (e) {
      logger.error(e);
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    getSettings();
  }, []);

  useEffect(() => {
    if (!deleteModalVisible && !editModalVisible && !logsModalVisible && !updateModalVisible) {
      setSelectedCluster(undefined);
    }
  }, [deleteModalVisible, editModalVisible, logsModalVisible, updateModalVisible]);

  return (
    <div>
      <div className={styles.actionPanel}>
        <AddNewClusterButton />
      </div>
      <AddDBClusterModal
        kubernetes={kubernetes}
        isVisible={addModalVisible}
        setVisible={setAddModalVisible}
        onDBClusterAdded={getDBClusters}
        showMonitoringWarning={settingsLoading || !settings?.publicAddress}
      />
      <DeleteDBClusterModal
        isVisible={deleteModalVisible}
        setVisible={setDeleteModalVisible}
        setLoading={setLoading}
        onClusterDeleted={getDBClusters}
        selectedCluster={selectedCluster}
      />
      {selectedCluster && (
        <EditDBClusterModal
          isVisible={editModalVisible}
          setVisible={setEditModalVisible}
          onDBClusterChanged={getDBClusters}
          selectedCluster={selectedCluster}
        />
      )}
      {logsModalVisible && (
        <DBClusterLogsModal isVisible={logsModalVisible} setVisible={setLogsModalVisible} dbCluster={selectedCluster} />
      )}
      {selectedCluster && updateModalVisible && (
        <UpdateDBClusterModal
          dbCluster={selectedCluster}
          isVisible={updateModalVisible}
          setVisible={setUpdateModalVisible}
          setLoading={setLoading}
          onUpdateFinished={getDBClusters}
        />
      )}
      <Table
        columns={columns}
        data={dbClusters}
        loading={loading}
        noData={<AddNewClusterButton />}
        rowKey={getRowKey}
      />
    </div>
  );
};
