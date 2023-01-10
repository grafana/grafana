/* eslint-disable @typescript-eslint/no-explicit-any */

import { CancelToken } from 'axios';
import React, { FC, useCallback, useMemo, useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';

import { useStyles } from '@grafana/ui';
import { OldPage } from 'app/core/components/Page/Page';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { Table } from 'app/percona/shared/components/Elements/Table';
import { TechnicalPreview } from 'app/percona/shared/components/Elements/TechnicalPreview/TechnicalPreview';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { useCatchCancellationError } from 'app/percona/shared/components/hooks/catchCancellationError';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { getDBaaS, getPerconaDBClusters, getPerconaSettingFlag } from 'app/percona/shared/core/selectors';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';

import { fetchDBClustersAction } from '../../../shared/core/reducers/dbaas/dbClusters/dbClusters';
import { selectDBCluster, selectKubernetesCluster } from '../../../shared/core/reducers/dbaas/dbaas';
import { useUpdateOfKubernetesList } from '../../hooks/useKubernetesList';
import { AddClusterButton } from '../AddClusterButton/AddClusterButton';
import { isKubernetesListUnavailable } from '../Kubernetes/Kubernetes.utils';

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
import { DBClusterLogsModal } from './DBClusterLogsModal/DBClusterLogsModal';
import { DeleteDBClusterModal } from './DeleteDBClusterModal/DeleteDBClusterModal';
import { RECHECK_INTERVAL } from './EditDBClusterPage/DBClusterAdvancedOptions/DBClusterAdvancedOptions.constants';
import { DB_CLUSTER_CREATION_URL } from './EditDBClusterPage/EditDBClusterPage.constants';
import { UpdateDBClusterModal } from './UpdateDBClusterModal/UpdateDBClusterModal';

export const DBCluster: FC = () => {
  const styles = useStyles(getStyles);
  const history = useHistory();
  const dispatch = useAppDispatch();
  const [kubernetes = [], kubernetesLoading] = useUpdateOfKubernetesList();
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [logsModalVisible, setLogsModalVisible] = useState(false);
  const [updateModalVisible, setUpdateModalVisible] = useState(false);

  const { result: dbClusters = [], loading: dbClustersLoading } = useSelector(getPerconaDBClusters);
  const { selectedDBCluster } = useSelector(getDBaaS);

  const navModel = usePerconaNavModel('dbclusters');
  const [generateToken] = useCancelToken();

  const [catchFromAsyncThunkAction] = useCatchCancellationError();
  const [loading, setLoading] = useState(kubernetesLoading);
  const addDisabled = kubernetes?.length === 0 || isKubernetesListUnavailable(kubernetes) || loading;

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
          setLogsModalVisible,
        }),
      },
      {
        Header: Messages.dbcluster.table.actionsColumn,
        accessor: clusterActionsRender({
          setDeleteModalVisible,
          setLogsModalVisible,
          setUpdateModalVisible,
          getDBClusters,
        }),
      },
    ],
    [setDeleteModalVisible, getDBClusters]
  );

  const AddNewClusterButton = useCallback(
    () => (
      <AddClusterButton
        label={Messages.dbcluster.addAction}
        disabled={addDisabled}
        action={() => history.push(DB_CLUSTER_CREATION_URL)}
        data-testid="dbcluster-add-cluster-button"
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addDisabled]
  );

  const getRowKey = useCallback(({ original }) => `${original.kubernetesClusterName}${original.clusterName}`, []);

  useEffect(() => {
    if (!deleteModalVisible && !logsModalVisible && !updateModalVisible) {
      dispatch(selectDBCluster(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteModalVisible, logsModalVisible, updateModalVisible]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const featureSelector = useCallback(getPerconaSettingFlag('dbaasEnabled'), []);

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
            <DeleteDBClusterModal
              isVisible={deleteModalVisible}
              setVisible={setDeleteModalVisible}
              setLoading={setLoading}
              onClusterDeleted={getDBClusters}
              selectedCluster={selectedDBCluster}
            />
            {logsModalVisible && (
              <DBClusterLogsModal
                isVisible={logsModalVisible}
                setVisible={setLogsModalVisible}
                dbCluster={selectedDBCluster}
              />
            )}
            {selectedDBCluster && updateModalVisible && (
              <UpdateDBClusterModal
                dbCluster={selectedDBCluster}
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
