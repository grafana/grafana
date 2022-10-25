/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '@percona/platform-core';
import { CancelToken } from 'axios';
import React, { FC, useCallback, useMemo, useState, useEffect } from 'react';
import { useSelector } from 'react-redux';

import { useStyles } from '@grafana/ui';
import { OldPage } from 'app/core/components/Page/Page';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { Table } from 'app/percona/shared/components/Elements/Table';
import { TechnicalPreview } from 'app/percona/shared/components/Elements/TechnicalPreview/TechnicalPreview';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { useCatchCancellationError } from 'app/percona/shared/components/hooks/catchCancellationError';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { addDbClusterAction, fetchKubernetesAction, selectKubernetesCluster } from 'app/percona/shared/core/reducers';
import {
  getKubernetes,
  getDBaaS,
  getPerconaDBClusters,
  getPerconaSettingFlag,
} from 'app/percona/shared/core/selectors';
import { useAppDispatch } from 'app/store/store';

import { fetchDBClustersAction, resetDBClustersToInitial } from '../../../shared/core/reducers/dbClusters/dbClusters';
import { AddClusterButton } from '../AddClusterButton/AddClusterButton';
import { CHECK_OPERATOR_UPDATE_CANCEL_TOKEN, GET_KUBERNETES_CANCEL_TOKEN } from '../Kubernetes/Kubernetes.constants';
import { isKubernetesListUnavailable } from '../Kubernetes/Kubernetes.utils';

import { AddDBClusterModal } from './AddDBClusterModal/AddDBClusterModal';
import { RECHECK_INTERVAL } from './AddDBClusterModal/DBClusterAdvancedOptions/DBClusterAdvancedOptions.constants';
import {
  clusterStatusRender,
  connectionRender,
  databaseTypeRender,
  parametersRender,
  clusterNameRender,
  clusterActionsRender,
} from './ColumnRenderers/ColumnRenderers';
import { GET_CLUSTERS_CANCEL_TOKEN } from './DBCluster.constants';
import { getStyles } from './DBCluster.styles';
import { DBCluster as DBClusterInterface } from './DBCluster.types';
import { DBClusterLogsModal } from './DBClusterLogsModal/DBClusterLogsModal';
import { DeleteDBClusterModal } from './DeleteDBClusterModal/DeleteDBClusterModal';
import { EditDBClusterModal } from './EditDBClusterModal/EditDBClusterModal';
import { UpdateDBClusterModal } from './UpdateDBClusterModal/UpdateDBClusterModal';

export const DBCluster: FC = () => {
  const styles = useStyles(getStyles);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [logsModalVisible, setLogsModalVisible] = useState(false);
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const { selectedKubernetesCluster } = useSelector(getDBaaS);
  const [addModalVisible, setAddModalVisible] = useState(!!selectedKubernetesCluster);
  const [selectedCluster, setSelectedCluster] = useState<DBClusterInterface>();
  const navModel = usePerconaNavModel('dbclusters');
  const dispatch = useAppDispatch();
  const [generateToken] = useCancelToken();
  const { result: kubernetes = [], loading: kubernetesLoading } = useSelector(getKubernetes);
  const { result: dbClusters = [], loading: dbClustersLoading } = useSelector(getPerconaDBClusters);
  const [catchFromAsyncThunkAction] = useCatchCancellationError();
  const [loading, setLoading] = useState(kubernetesLoading);
  const addDisabled = kubernetes.length === 0 || isKubernetesListUnavailable(kubernetes) || loading;

  const getDBClusters = useCallback(
    async (triggerLoading = true) => {
      if (!kubernetes.length) {
        return;
      }

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

      setLoading(false);
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

  const addCluster = async (values: Record<string, any>, showPMMAddressWarning: boolean) => {
    try {
      await dispatch(addDbClusterAction({ values, setPMMAddress: showPMMAddressWarning })).unwrap();
      setAddModalVisible(false);
      getDBClusters(true);
    } catch (e) {
      logger.error(e);
    }
  };

  const getRowKey = useCallback(({ original }) => `${original.kubernetesClusterName}${original.clusterName}`, []);

  useEffect(() => {
    if (!deleteModalVisible && !editModalVisible && !logsModalVisible && !updateModalVisible) {
      setSelectedCluster(undefined);
    }
  }, [deleteModalVisible, editModalVisible, logsModalVisible, updateModalVisible]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const featureSelector = useCallback(getPerconaSettingFlag('dbaasEnabled'), []);

  useEffect(() => {
    if (!selectedKubernetesCluster) {
      dispatch(
        fetchKubernetesAction({
          kubernetes: generateToken(GET_KUBERNETES_CANCEL_TOKEN),
          operator: generateToken(CHECK_OPERATOR_UPDATE_CANCEL_TOKEN),
        })
      );
    }
    return () => {
      dispatch(resetDBClustersToInitial());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      dispatch(selectKubernetesCluster(null));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    getDBClusters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kubernetes]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (!dbClustersLoading) {
      timeout = setTimeout(getDBClusters, RECHECK_INTERVAL, false);
    }
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbClustersLoading]);

  useEffect(
    () =>
      setLoading((prevLoading) => {
        if (!kubernetesLoading && !kubernetes.length) {
          return false;
        }
        return prevLoading || kubernetesLoading;
      }),
    [kubernetes.length, kubernetesLoading]
  );

  return (
    <OldPage navModel={navModel}>
      <OldPage.Contents>
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
              onSubmit={addCluster}
              preSelectedKubernetesCluster={selectedKubernetesCluster}
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
      </OldPage.Contents>
    </OldPage>
  );
};

export default DBCluster;
