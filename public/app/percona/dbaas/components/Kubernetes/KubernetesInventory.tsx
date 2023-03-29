/* eslint-disable react/display-name */
import { CheckboxField, Modal } from '@percona/platform-core';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Form } from 'react-final-form';
import { Column } from 'react-table';

import { Button, HorizontalGroup, useStyles } from '@grafana/ui';
import { OldPage } from 'app/core/components/Page/Page';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { Table } from 'app/percona/shared/components/Elements/Table';
import { TechnicalPreview } from 'app/percona/shared/components/Elements/TechnicalPreview/TechnicalPreview';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { useCatchCancellationError } from 'app/percona/shared/components/hooks/catchCancellationError';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { deleteKubernetesAction } from 'app/percona/shared/core/reducers';
import { fetchK8sListAction } from 'app/percona/shared/core/reducers/dbaas/k8sClusterList/k8sClusterList';
import { getAddKubernetes, getDeleteKubernetes, getPerconaSettingFlag } from 'app/percona/shared/core/selectors';
import { useSelector } from 'app/types';

import { useAppDispatch } from '../../../../store/store';
import { useKubernetesList } from '../../hooks/useKubernetesList';
import { AddClusterButton } from '../AddClusterButton/AddClusterButton';

import { clusterActionsRender } from './ColumnRenderers/ColumnRenderers';
import { K8sPageMode } from './K8sRouting/K8sRouting';
import {
  CHECK_OPERATOR_UPDATE_CANCEL_TOKEN,
  GET_KUBERNETES_CANCEL_TOKEN,
  RECHECK_INTERVAL,
} from './Kubernetes.constants';
import { getStyles } from './Kubernetes.styles';
import { Kubernetes, OperatorToUpdate } from './Kubernetes.types';
import { KubernetesClusterStatus } from './KubernetesClusterStatus/KubernetesClusterStatus';
import { KubernetesClusterStatus as K8SStatus } from './KubernetesClusterStatus/KubernetesClusterStatus.types';
import { ManageComponentsVersionsModal } from './ManageComponentsVersionsModal/ManageComponentsVersionsModal';
import { UpdateOperatorModal } from './OperatorStatusItem/KubernetesOperatorStatus/UpdateOperatorModal/UpdateOperatorModal';
import { OperatorStatusRow } from './OperatorStatusRow/OperatorStatusRow';
import { PortalK8sFreeClusterPromotingMessage } from './PortalK8sFreeClusterPromotingMessage/PortalK8sFreeClusterPromotingMessage';
import { ViewClusterConfigModal } from './ViewClusterConfigModal/ViewClusterConfigModal';

interface KubernetesInventoryProps {
  setMode: React.Dispatch<React.SetStateAction<K8sPageMode>>;
}

export const KubernetesInventory: FC<KubernetesInventoryProps> = ({ setMode }) => {
  const styles = useStyles(getStyles);
  const appDispatch = useAppDispatch();
  const navModel = usePerconaNavModel('kubernetes');
  const [selectedCluster, setSelectedCluster] = useState<Kubernetes | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [viewConfigModalVisible, setViewConfigModalVisible] = useState(false);
  const [manageComponentsModalVisible, setManageComponentsModalVisible] = useState(false);
  const [operatorToUpdate, setOperatorToUpdate] = useState<OperatorToUpdate | null>(null);
  const [updateOperatorModalVisible, setUpdateOperatorModalVisible] = useState(false);
  const [generateToken] = useCancelToken();
  const [kubernetes, kubernetesLoading] = useKubernetesList();
  const { loading: deleteKubernetesLoading } = useSelector(getDeleteKubernetes);
  const { loading: addKubernetesLoading } = useSelector(getAddKubernetes);
  const [update, setUpdate] = useState(false);
  const [catchFromAsyncThunkAction] = useCatchCancellationError();

  const loading = (kubernetesLoading || deleteKubernetesLoading || addKubernetesLoading) && !update;
  const k8sListShouldBeUpdated = kubernetes && kubernetes.find((item) => item.status === K8SStatus.provisioning);

  const deleteKubernetesCluster = useCallback(
    async (force?: boolean) => {
      if (selectedCluster) {
        setDeleteModalVisible(false);
        await appDispatch(deleteKubernetesAction({ kubernetesToDelete: selectedCluster, force }));
        setSelectedCluster(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedCluster]
  );

  const updateK8Clusters = useCallback(
    async (triggerLoading = true) => {
      await catchFromAsyncThunkAction(
        appDispatch(
          fetchK8sListAction({
            tokens: {
              kubernetes: generateToken(GET_KUBERNETES_CANCEL_TOKEN),
              operator: generateToken(CHECK_OPERATOR_UPDATE_CANCEL_TOKEN),
            },
          })
        )
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kubernetes]
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
          <OperatorStatusRow
            element={element}
            setSelectedCluster={setSelectedCluster}
            setOperatorToUpdate={setOperatorToUpdate}
            setUpdateOperatorModalVisible={setUpdateOperatorModalVisible}
          />
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
        action={() => setMode('register')}
        data-testid="kubernetes-new-cluster-button"
      />
    ),
    [setMode]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const featureSelector = useCallback(getPerconaSettingFlag('dbaasEnabled'), []);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (!kubernetesLoading && k8sListShouldBeUpdated) {
      if (!update) {
        setUpdate(true);
      }
      timeout = setTimeout(updateK8Clusters, RECHECK_INTERVAL, false);
    }
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kubernetesLoading]);

  return (
    <OldPage navModel={navModel}>
      <OldPage.Contents>
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
                setSelectedCluster={setSelectedCluster}
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
            <Table
              columns={columns}
              data={kubernetes ? kubernetes : []}
              loading={loading}
              noData={<AddNewClusterButton />}
            />
          </div>
        </FeatureLoader>
        {kubernetes && kubernetes.length === 0 && <PortalK8sFreeClusterPromotingMessage />}
      </OldPage.Contents>
    </OldPage>
  );
};

export default KubernetesInventory;
