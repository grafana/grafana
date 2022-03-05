/* eslint-disable react/display-name */
import React, { FC, useCallback, useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Button, HorizontalGroup, useStyles } from '@grafana/ui';
import { Column } from 'react-table';
import { Modal, CheckboxField } from '@percona/platform-core';
import { Table } from 'app/percona/shared/components/Elements/Table/Table';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { Form } from 'react-final-form';
import { Databases } from 'app/percona/shared/core';
import { getStyles } from './Kubernetes.styles';
import { KubernetesProps, Kubernetes, OperatorToUpdate } from './Kubernetes.types';
import { AddClusterButton } from '../AddClusterButton/AddClusterButton';
import { OperatorStatusItem } from './OperatorStatusItem/OperatorStatusItem';
import { KubernetesClusterStatus } from './KubernetesClusterStatus/KubernetesClusterStatus';
import { clusterActionsRender } from './ColumnRenderers/ColumnRenderers';
import { ViewClusterConfigModal } from './ViewClusterConfigModal/ViewClusterConfigModal';
import { ManageComponentsVersionsModal } from './ManageComponentsVersionsModal/ManageComponentsVersionsModal';
import { UpdateOperatorModal } from './OperatorStatusItem/KubernetesOperatorStatus/UpdateOperatorModal/UpdateOperatorModal';
import { AddKubernetesModal } from './AddKubernetesModal/AddKubernetesModal';
import { getPerconaSettings } from '../../../shared/core/selectors';

export const KubernetesInventory: FC<KubernetesProps> = ({
  kubernetes,
  deleteKubernetes,
  addKubernetes,
  getKubernetes,
  setLoading,
  loading,
}) => {
  const styles = useStyles(getStyles);
  const [selectedCluster, setSelectedCluster] = useState<Kubernetes | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [viewConfigModalVisible, setViewConfigModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [manageComponentsModalVisible, setManageComponentsModalVisible] = useState(false);
  const [operatorToUpdate, setOperatorToUpdate] = useState<OperatorToUpdate | null>(null);
  const [updateOperatorModalVisible, setUpdateOperatorModalVisible] = useState(false);
  const { isLoading, publicAddress } = useSelector(getPerconaSettings);

  const deleteKubernetesCluster = useCallback(
    (force?: boolean) => {
      if (selectedCluster) {
        deleteKubernetes(selectedCluster, force);
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

  const showMonitoringWarning = useMemo(() => isLoading || !publicAddress, [publicAddress, isLoading]);

  return (
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
          setLoading={setLoading}
          setSelectedCluster={setSelectedCluster}
          setOperatorToUpdate={setOperatorToUpdate}
          onOperatorUpdated={getKubernetes}
        />
      )}
      <Table columns={columns} data={kubernetes} loading={loading} noData={<AddNewClusterButton />} />
    </div>
  );
};
