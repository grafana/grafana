import React, { FC, useCallback, useMemo, useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useStyles } from '@grafana/ui';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import Page from 'app/core/components/Page/Page';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { TechnicalPreview } from 'app/percona/shared/components/Elements/TechnicalPreview/TechnicalPreview';
import { Table } from 'app/percona/shared/components/Elements/Table';
import {
  getKubernetes,
  getPerconaDBClusters,
  getPerconaSettingFlag,
  getPerconaSettings,
} from 'app/percona/shared/core/selectors';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { AddClusterButton } from '../AddClusterButton/AddClusterButton';
import { getStyles } from './DBCluster.styles';
import { DBCluster as Cluster } from './DBCluster.types';
import { AddDBClusterModal } from './AddDBClusterModal/AddDBClusterModal';
import { EditDBClusterModal } from './EditDBClusterModal/EditDBClusterModal';
import { DBClusterLogsModal } from './DBClusterLogsModal/DBClusterLogsModal';
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
import { fetchDBClustersAction, fetchKubernetesAction } from 'app/percona/shared/core/reducers';
import { useCatchCancellationError } from 'app/percona/shared/components/hooks/catchCancellationError';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { CHECK_OPERATOR_UPDATE_CANCEL_TOKEN, GET_KUBERNETES_CANCEL_TOKEN } from '../Kubernetes/Kubernetes.constants';
import { RECHECK_INTERVAL } from './AddDBClusterModal/DBClusterAdvancedOptions/DBClusterAdvancedOptions.constants';
import { CancelToken } from 'axios';
import { isKubernetesListUnavailable } from '../Kubernetes/Kubernetes.utils';
import { GET_CLUSTERS_CANCEL_TOKEN } from './DBCluster.constants';
import { useAppDispatch } from 'app/store/store';

export const DBCluster: FC = () => {
  const styles = useStyles(getStyles);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [logsModalVisible, setLogsModalVisible] = useState(false);
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<Cluster>();
  const navModel = usePerconaNavModel('dbclusters');
  const dispatch = useAppDispatch();
  const [generateToken] = useCancelToken();
  const { result: settings, loading: settingsLoading } = useSelector(getPerconaSettings);
  const { result: kubernetes = [], loading: kubernetesLoading } = useSelector(getKubernetes);
  const { result: dbClusters = [] } = useSelector(getPerconaDBClusters);
  const [catchFromAsyncThunkAction] = useCatchCancellationError();
  const [loading, setLoading] = useState(kubernetesLoading);
  const addDisabled = kubernetes.length === 0 || isKubernetesListUnavailable(kubernetes) || loading;

  const getDBClusters = useCallback(
    async (triggerLoading = true) => {
      if (triggerLoading) {
        setLoading(true);
      }

      const tokens: CancelToken[] = kubernetes.map((k) =>
        generateToken(`${GET_CLUSTERS_CANCEL_TOKEN}-${k.kubernetesClusterName}`)
      );

      const result = await catchFromAsyncThunkAction(dispatch(fetchDBClustersAction({ kubernetes, tokens })));

      // undefined means request was cancelled
      if (result === undefined) {
        return;
      }

      if (triggerLoading) {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kubernetes]
  );

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
        disabled={addDisabled}
        action={() => setAddModalVisible(!addModalVisible)}
        data-testid="dbcluster-add-cluster-button"
      />
    ),
    [addModalVisible, addDisabled]
  );

  const getRowKey = useCallback(({ original }) => `${original.kubernetesClusterName}${original.clusterName}`, []);

  useEffect(() => {
    if (!deleteModalVisible && !editModalVisible && !logsModalVisible && !updateModalVisible) {
      setSelectedCluster(undefined);
    }
  }, [deleteModalVisible, editModalVisible, logsModalVisible, updateModalVisible]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const featureSelector = useCallback(getPerconaSettingFlag('dbaasEnabled'), []);

  useEffect(() => {
    dispatch(
      fetchKubernetesAction({
        kubernetes: generateToken(GET_KUBERNETES_CANCEL_TOKEN),
        operator: generateToken(CHECK_OPERATOR_UPDATE_CANCEL_TOKEN),
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (kubernetes && kubernetes.length > 0) {
      getDBClusters();

      timer = setInterval(() => getDBClusters(false), RECHECK_INTERVAL);
    }

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kubernetes]);

  useEffect(() => setLoading((prevLoading) => prevLoading || kubernetesLoading), [kubernetesLoading]);

  const showMonitoringWarning = useMemo(() => settingsLoading || !settings?.publicAddress, [
    settings?.publicAddress,
    settingsLoading,
  ]);

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <TechnicalPreview />
        <FeatureLoader featureName={Messages.dbaas} featureSelector={featureSelector}>
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
              <DBClusterLogsModal
                isVisible={logsModalVisible}
                setVisible={setLogsModalVisible}
                dbCluster={selectedCluster}
              />
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
        </FeatureLoader>
      </Page.Contents>
    </Page>
  );
};

export default DBCluster;
