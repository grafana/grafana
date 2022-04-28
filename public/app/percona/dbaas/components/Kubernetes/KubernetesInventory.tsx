/* eslint-disable react/display-name */
import React, { FC, useCallback, useState, useMemo, useEffect } from 'react';
import { Button, HorizontalGroup, useStyles } from '@grafana/ui';
import { Column } from 'react-table';
import { useDispatch, useSelector } from 'react-redux';
import { Modal, CheckboxField } from '@percona/platform-core';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import Page from 'app/core/components/Page/Page';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { TechnicalPreview } from 'app/percona/shared/components/Elements/TechnicalPreview/TechnicalPreview';
import { fetchKubernetesAction, deleteKubernetesAction, addKubernetesAction } from 'app/percona/shared/core/reducers';
import {
  getKubernetes as getKubernetesSelector,
  getDeleteKubernetes,
  getAddKubernetes,
  getPerconaSettingFlag,
  getPerconaSettings,
} from 'app/percona/shared/core/selectors';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { Table } from 'app/percona/shared/components/Elements/Table/Table';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { Form } from 'react-final-form';
import { Databases } from 'app/percona/shared/core';
import { getStyles } from './Kubernetes.styles';
import { Kubernetes, OperatorToUpdate, NewKubernetesCluster } from './Kubernetes.types';
import { AddClusterButton } from '../AddClusterButton/AddClusterButton';
import { OperatorStatusItem } from './OperatorStatusItem/OperatorStatusItem';
import { KubernetesClusterStatus } from './KubernetesClusterStatus/KubernetesClusterStatus';
import { clusterActionsRender } from './ColumnRenderers/ColumnRenderers';
import { ViewClusterConfigModal } from './ViewClusterConfigModal/ViewClusterConfigModal';
import { ManageComponentsVersionsModal } from './ManageComponentsVersionsModal/ManageComponentsVersionsModal';
import { UpdateOperatorModal } from './OperatorStatusItem/KubernetesOperatorStatus/UpdateOperatorModal/UpdateOperatorModal';
import { AddKubernetesModal } from './AddKubernetesModal/AddKubernetesModal';
import {
  GET_KUBERNETES_CANCEL_TOKEN,
  CHECK_OPERATOR_UPDATE_CANCEL_TOKEN,
  DELETE_KUBERNETES_CANCEL_TOKEN,
} from './Kubernetes.constants';

export const KubernetesInventory: FC = () => {
  const styles = useStyles(getStyles);
  const dispatch = useDispatch();
  const navModel = usePerconaNavModel('kubernetes');
  const [selectedCluster, setSelectedCluster] = useState<Kubernetes | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [viewConfigModalVisible, setViewConfigModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [manageComponentsModalVisible, setManageComponentsModalVisible] = useState(false);
  const [operatorToUpdate, setOperatorToUpdate] = useState<OperatorToUpdate | null>(null);
  const [updateOperatorModalVisible, setUpdateOperatorModalVisible] = useState(false);
  const [generateToken] = useCancelToken();
  const { result: kubernetes = [], loading: kubernetesLoading } = useSelector(getKubernetesSelector);
  const { loading: deleteKubernetesLoading } = useSelector(getDeleteKubernetes);
  const { loading: addKubernetesLoading } = useSelector(getAddKubernetes);
  const loading = kubernetesLoading || deleteKubernetesLoading || addKubernetesLoading;
  const { loading: settingsLoading, result: settings } = useSelector(getPerconaSettings);
  const showMonitoringWarning = useMemo(() => settingsLoading || !settings?.publicAddress, [
    settings?.publicAddress,
    settingsLoading,
  ]);

  const deleteKubernetesCluster = useCallback(
    (force?: boolean) => {
      if (selectedCluster) {
        dispatch(deleteKubernetesAction({ kubernetesToDelete: selectedCluster, force }));
        setDeleteModalVisible(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedCluster]
  );

  const columns = useMemo(
    (): Array<Column<Kubernetes>> => [
      {
        Header: Messages.kubernetes.table.nameColumn,
        accessor: 'kubernetesClusterName',
      },
      {
        Header: Messages.kubernetes.table.clusterStatusColumn,
        accessor: (element: Kubernetes) => <KubernetesClusterStatus status={element.status} />,
      },
      {
        Header: Messages.kubernetes.table.operatorsColumn,
        accessor: (element: Kubernetes) => (
          <div>
            <OperatorStatusItem
              databaseType={Databases.mysql}
              operator={element.operators.pxc}
              kubernetes={element}
              setSelectedCluster={setSelectedCluster}
              setOperatorToUpdate={setOperatorToUpdate}
              setUpdateOperatorModalVisible={setUpdateOperatorModalVisible}
            />
            <OperatorStatusItem
              databaseType={Databases.mongodb}
              operator={element.operators.psmdb}
              kubernetes={element}
              setSelectedCluster={setSelectedCluster}
              setOperatorToUpdate={setOperatorToUpdate}
              setUpdateOperatorModalVisible={setUpdateOperatorModalVisible}
            />
          </div>
        ),
      },
      {
        Header: Messages.kubernetes.table.actionsColumn,
        accessor: (kubernetesCluster: Kubernetes) =>
          clusterActionsRender({
            setSelectedCluster,
            setDeleteModalVisible,
            setViewConfigModalVisible,
            setManageComponentsModalVisible,
          })(kubernetesCluster),
      },
    ],
    []
  );

  const AddNewClusterButton = useCallback(
    () => (
      <AddClusterButton
        label={Messages.kubernetes.addAction}
        action={() => setAddModalVisible(!addModalVisible)}
        data-testid="kubernetes-new-cluster-button"
      />
    ),
    [addModalVisible]
  );

  const addKubernetes = useCallback((cluster: NewKubernetesCluster) => {
    dispatch(addKubernetesAction({ kubernetesToAdd: cluster, token: generateToken(DELETE_KUBERNETES_CANCEL_TOKEN) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <TechnicalPreview />
        <FeatureLoader featureName={Messages.dbaas} featureSelector={featureSelector}>
          <div>
            <div className={styles.actionPanel}>
              <AddNewClusterButton />
            </div>
            {selectedCluster && (
              <ViewClusterConfigModal
                isVisible={viewConfigModalVisible}
                setVisible={() => setViewConfigModalVisible(false)}
                selectedCluster={selectedCluster}
              />
            )}
            <AddKubernetesModal
              isVisible={addModalVisible}
              addKubernetes={addKubernetes}
              setAddModalVisible={setAddModalVisible}
              showMonitoringWarning={showMonitoringWarning}
            />
            <Modal
              title={Messages.kubernetes.deleteModal.title}
              isVisible={deleteModalVisible}
              onClose={() => setDeleteModalVisible(false)}
            >
              <Form
                onSubmit={() => {}}
                render={({ form, handleSubmit }) => (
                  <form onSubmit={handleSubmit}>
                    <>
                      <h4 className={styles.deleteModalContent}>{Messages.kubernetes.deleteModal.confirmMessage}</h4>
                      <CheckboxField name="force" label={Messages.kubernetes.deleteModal.labels.force} />
                      <HorizontalGroup justify="space-between" spacing="md">
                        <Button
                          variant="secondary"
                          size="md"
                          onClick={() => setDeleteModalVisible(false)}
                          data-testid="cancel-delete-kubernetes-button"
                        >
                          {Messages.kubernetes.deleteModal.cancel}
                        </Button>
                        <Button
                          variant="destructive"
                          size="md"
                          onClick={() => deleteKubernetesCluster(Boolean(form.getState().values.force))}
                          data-testid="delete-kubernetes-button"
                        >
                          {Messages.kubernetes.deleteModal.confirm}
                        </Button>
                      </HorizontalGroup>
                    </>
                  </form>
                )}
              />
            </Modal>
            {selectedCluster && manageComponentsModalVisible && (
              <ManageComponentsVersionsModal
                selectedKubernetes={selectedCluster}
                isVisible={manageComponentsModalVisible}
                setVisible={setManageComponentsModalVisible}
              />
            )}
            {selectedCluster && operatorToUpdate && updateOperatorModalVisible && (
              <UpdateOperatorModal
                kubernetesClusterName={selectedCluster.kubernetesClusterName}
                isVisible={updateOperatorModalVisible}
                selectedOperator={operatorToUpdate}
                setVisible={setUpdateOperatorModalVisible}
                setSelectedCluster={setSelectedCluster}
                setOperatorToUpdate={setOperatorToUpdate}
              />
            )}
            <Table columns={columns} data={kubernetes} loading={loading} noData={<AddNewClusterButton />} />
          </div>
        </FeatureLoader>
      </Page.Contents>
    </Page>
  );
};

export default KubernetesInventory;
