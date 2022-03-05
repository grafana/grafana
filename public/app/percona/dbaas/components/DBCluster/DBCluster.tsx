import React, { FC, useCallback, useMemo, useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useStyles } from '@grafana/ui';
import { Table } from 'app/percona/shared/components/Elements/Table';
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
import { UpdateDBClusterModal } from './UpdateDBClusterModal/UpdateDBClusterModal';
import { getPerconaSettings } from '../../../shared/core/selectors';

export const DBCluster: FC<DBClusterProps> = ({ kubernetes }) => {
  const styles = useStyles(getStyles);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [logsModalVisible, setLogsModalVisible] = useState(false);
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<Cluster>();
  const [dbClusters, getDBClusters, setLoading, loading] = useDBClusters(kubernetes);
  const { isLoading, publicAddress } = useSelector(getPerconaSettings);

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
    [addModalVisible]
  );

  const getRowKey = useCallback(({ original }) => `${original.kubernetesClusterName}${original.clusterName}`, []);

  useEffect(() => {
    if (!deleteModalVisible && !editModalVisible && !logsModalVisible && !updateModalVisible) {
      setSelectedCluster(undefined);
    }
  }, [deleteModalVisible, editModalVisible, logsModalVisible, updateModalVisible]);

  const showMonitoringWarning = useMemo(() => isLoading || !publicAddress, [publicAddress, isLoading]);

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
        showMonitoringWarning={showMonitoringWarning}
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
