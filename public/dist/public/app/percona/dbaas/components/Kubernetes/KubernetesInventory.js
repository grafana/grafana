import { __awaiter } from "tslib";
/* eslint-disable react/display-name */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Form } from 'react-final-form';
import { Button, HorizontalGroup, useStyles } from '@grafana/ui';
import { OldPage } from 'app/core/components/Page/Page';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { Table } from 'app/percona/shared/components/Elements/AnotherTableInstance';
import { CheckboxField } from 'app/percona/shared/components/Elements/Checkbox';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { Modal } from 'app/percona/shared/components/Elements/Modal';
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
import DbaasDeprecationWarning from '../DeprecationWarning';
import { clusterActionsRender } from './ColumnRenderers/ColumnRenderers';
import { CHECK_OPERATOR_UPDATE_CANCEL_TOKEN, GET_KUBERNETES_CANCEL_TOKEN, RECHECK_INTERVAL, } from './Kubernetes.constants';
import { getStyles } from './Kubernetes.styles';
import { KubernetesClusterStatus } from './KubernetesClusterStatus/KubernetesClusterStatus';
import { KubernetesClusterStatus as K8SStatus } from './KubernetesClusterStatus/KubernetesClusterStatus.types';
import { ManageComponentsVersionsModal } from './ManageComponentsVersionsModal/ManageComponentsVersionsModal';
import { UpdateOperatorModal } from './OperatorStatusItem/KubernetesOperatorStatus/UpdateOperatorModal/UpdateOperatorModal';
import { OperatorStatusRow } from './OperatorStatusRow/OperatorStatusRow';
import { ViewClusterConfigModal } from './ViewClusterConfigModal/ViewClusterConfigModal';
export const KubernetesInventory = ({ setMode }) => {
    const styles = useStyles(getStyles);
    const appDispatch = useAppDispatch();
    const navModel = usePerconaNavModel('kubernetes');
    const [selectedCluster, setSelectedCluster] = useState(null);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [viewConfigModalVisible, setViewConfigModalVisible] = useState(false);
    const [manageComponentsModalVisible, setManageComponentsModalVisible] = useState(false);
    const [operatorToUpdate, setOperatorToUpdate] = useState(null);
    const [updateOperatorModalVisible, setUpdateOperatorModalVisible] = useState(false);
    const [generateToken] = useCancelToken();
    const [kubernetes, kubernetesLoading] = useKubernetesList();
    const { loading: deleteKubernetesLoading } = useSelector(getDeleteKubernetes);
    const { loading: addKubernetesLoading } = useSelector(getAddKubernetes);
    const [update, setUpdate] = useState(false);
    const [catchFromAsyncThunkAction] = useCatchCancellationError();
    const loading = (kubernetesLoading || deleteKubernetesLoading || addKubernetesLoading) && !update;
    const k8sListShouldBeUpdated = kubernetes && kubernetes.find((item) => item.status === K8SStatus.provisioning);
    const deleteKubernetesCluster = useCallback((force) => __awaiter(void 0, void 0, void 0, function* () {
        if (selectedCluster) {
            setDeleteModalVisible(false);
            yield appDispatch(deleteKubernetesAction({ kubernetesToDelete: selectedCluster, force }));
            setSelectedCluster(null);
        }
    }), 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedCluster]);
    const updateK8Clusters = useCallback((triggerLoading = true) => __awaiter(void 0, void 0, void 0, function* () {
        yield catchFromAsyncThunkAction(appDispatch(fetchK8sListAction({
            tokens: {
                kubernetes: generateToken(GET_KUBERNETES_CANCEL_TOKEN),
                operator: generateToken(CHECK_OPERATOR_UPDATE_CANCEL_TOKEN),
            },
        })));
    }), 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kubernetes]);
    const columns = useMemo(() => [
        {
            Header: Messages.kubernetes.table.nameColumn,
            accessor: 'kubernetesClusterName',
        },
        {
            Header: Messages.kubernetes.table.clusterStatusColumn,
            accessor: (element) => React.createElement(KubernetesClusterStatus, { status: element.status }),
        },
        {
            Header: Messages.kubernetes.table.operatorsColumn,
            accessor: (element) => (React.createElement(OperatorStatusRow, { element: element, setSelectedCluster: setSelectedCluster, setOperatorToUpdate: setOperatorToUpdate, setUpdateOperatorModalVisible: setUpdateOperatorModalVisible })),
        },
        {
            Header: Messages.kubernetes.table.actionsColumn,
            accessor: (kubernetesCluster) => clusterActionsRender({
                setSelectedCluster,
                setDeleteModalVisible,
                setViewConfigModalVisible,
                setManageComponentsModalVisible,
            })(kubernetesCluster),
        },
    ], []);
    const AddNewClusterButton = useCallback(() => (React.createElement(AddClusterButton, { label: Messages.kubernetes.addAction, action: () => setMode('register'), "data-testid": "kubernetes-new-cluster-button" })), [setMode]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const featureSelector = useCallback(getPerconaSettingFlag('dbaasEnabled'), []);
    useEffect(() => {
        let timeout;
        if (!kubernetesLoading && k8sListShouldBeUpdated) {
            if (!update) {
                setUpdate(true);
            }
            timeout = setTimeout(updateK8Clusters, RECHECK_INTERVAL, false);
        }
        return () => clearTimeout(timeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kubernetesLoading]);
    return (React.createElement(OldPage, { navModel: navModel },
        React.createElement(OldPage.Contents, null,
            React.createElement(TechnicalPreview, null),
            React.createElement(FeatureLoader, { featureName: Messages.dbaas, featureSelector: featureSelector },
                React.createElement(DbaasDeprecationWarning, null),
                React.createElement("div", null,
                    React.createElement("div", { className: styles.actionPanel },
                        React.createElement(AddNewClusterButton, null)),
                    selectedCluster && (React.createElement(ViewClusterConfigModal, { isVisible: viewConfigModalVisible, setVisible: () => setViewConfigModalVisible(false), selectedCluster: selectedCluster })),
                    React.createElement(Modal, { title: Messages.kubernetes.deleteModal.title, isVisible: deleteModalVisible, onClose: () => setDeleteModalVisible(false) },
                        React.createElement(Form, { onSubmit: () => { }, render: ({ form, handleSubmit }) => (React.createElement("form", { onSubmit: handleSubmit },
                                React.createElement(React.Fragment, null,
                                    React.createElement("h4", { className: styles.deleteModalContent }, Messages.kubernetes.deleteModal.confirmMessage),
                                    React.createElement(CheckboxField, { name: "force", label: Messages.kubernetes.deleteModal.labels.force }),
                                    React.createElement(HorizontalGroup, { justify: "space-between", spacing: "md" },
                                        React.createElement(Button, { variant: "secondary", size: "md", onClick: () => setDeleteModalVisible(false), "data-testid": "cancel-delete-kubernetes-button" }, Messages.kubernetes.deleteModal.cancel),
                                        React.createElement(Button, { variant: "destructive", size: "md", onClick: () => deleteKubernetesCluster(Boolean(form.getState().values.force)), "data-testid": "delete-kubernetes-button" }, Messages.kubernetes.deleteModal.confirm))))) })),
                    selectedCluster && manageComponentsModalVisible && (React.createElement(ManageComponentsVersionsModal, { selectedKubernetes: selectedCluster, isVisible: manageComponentsModalVisible, setVisible: setManageComponentsModalVisible, setSelectedCluster: setSelectedCluster })),
                    selectedCluster && operatorToUpdate && updateOperatorModalVisible && (React.createElement(UpdateOperatorModal, { kubernetesClusterName: selectedCluster.kubernetesClusterName, isVisible: updateOperatorModalVisible, selectedOperator: operatorToUpdate, setVisible: setUpdateOperatorModalVisible, setSelectedCluster: setSelectedCluster, setOperatorToUpdate: setOperatorToUpdate })),
                    React.createElement(Table, { columns: columns, data: kubernetes ? kubernetes : [], loading: loading, noData: React.createElement(AddNewClusterButton, null) }))))));
};
export default KubernetesInventory;
//# sourceMappingURL=KubernetesInventory.js.map