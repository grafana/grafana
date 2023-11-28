import { __awaiter } from "tslib";
/* eslint-disable @typescript-eslint/consistent-type-assertions,@typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Form } from 'react-final-form';
import { AppEvents } from '@grafana/data';
import { Badge, Button, HorizontalGroup, Icon, Link, Modal, TagList, useStyles2 } from '@grafana/ui';
import { OldPage } from 'app/core/components/Page/Page';
import { CheckboxField } from 'app/percona/shared/components/Elements/Checkbox';
import { DetailsRow } from 'app/percona/shared/components/Elements/DetailsRow/DetailsRow';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { FilterFieldTypes, Table } from 'app/percona/shared/components/Elements/Table';
import { FormElement } from 'app/percona/shared/components/Form';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { fetchNodesAction, removeNodesAction } from 'app/percona/shared/core/reducers/nodes/nodes';
import { getNodes } from 'app/percona/shared/core/selectors';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { capitalizeText } from 'app/percona/shared/helpers/capitalizeText';
import { getExpandAndActionsCol } from 'app/percona/shared/helpers/getExpandAndActionsCol';
import { logger } from 'app/percona/shared/helpers/logger';
import { NodeType } from 'app/percona/shared/services/nodes/Nodes.types';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';
import { appEvents } from '../../../core/app_events';
import { CLUSTERS_SWITCH_KEY, GET_NODES_CANCEL_TOKEN } from '../Inventory.constants';
import { Messages } from '../Inventory.messages';
import { MonitoringStatus } from '../Inventory.types';
import { StatusBadge } from '../components/StatusBadge/StatusBadge';
import { StatusLink } from '../components/StatusLink/StatusLink';
import { getServiceLink, stripNodeId } from './Nodes.utils';
import { getBadgeColorForServiceStatus, getBadgeIconForServiceStatus } from './Services.utils';
import { getStyles } from './Tabs.styles';
export const NodesTab = () => {
    const { isLoading, nodes } = useSelector(getNodes);
    const [modalVisible, setModalVisible] = useState(false);
    const [selected, setSelectedRows] = useState([]);
    const [actionItem, setActionItem] = useState(null);
    const navModel = usePerconaNavModel('inventory-nodes');
    const [generateToken] = useCancelToken();
    const styles = useStyles2(getStyles);
    const dispatch = useAppDispatch();
    const getActions = useCallback((row) => [
        {
            content: (React.createElement(HorizontalGroup, { spacing: "sm" },
                React.createElement(Icon, { name: "trash-alt" }),
                React.createElement("span", { className: styles.actionItemTxtSpan }, Messages.delete))),
            action: () => {
                setActionItem(row.original);
                setModalVisible(true);
            },
        },
    ], [styles.actionItemTxtSpan]);
    const clearClusterToggle = useCallback(() => {
        // Reset toggle to false when linking from nodes
        localStorage.removeItem(CLUSTERS_SWITCH_KEY);
    }, []);
    const columns = useMemo(() => [
        {
            Header: Messages.services.columns.nodeId,
            id: 'nodeId',
            accessor: 'nodeId',
            hidden: true,
            type: FilterFieldTypes.TEXT,
        },
        {
            Header: Messages.services.columns.status,
            accessor: 'status',
            Cell: ({ value }) => (React.createElement(Badge, { text: capitalizeText(value), color: getBadgeColorForServiceStatus(value), icon: getBadgeIconForServiceStatus(value) })),
        },
        {
            Header: Messages.nodes.columns.nodeName,
            accessor: 'nodeName',
            type: FilterFieldTypes.TEXT,
        },
        {
            Header: Messages.nodes.columns.nodeType,
            accessor: 'nodeType',
            type: FilterFieldTypes.DROPDOWN,
            options: [
                {
                    label: 'Container',
                    value: NodeType.container,
                },
                {
                    label: 'Generic',
                    value: NodeType.generic,
                },
                {
                    label: 'Remote',
                    value: NodeType.remote,
                },
                {
                    label: 'RemoteAzureDB',
                    value: NodeType.remoteAzureDB,
                },
                {
                    label: 'RemoteRDS',
                    value: NodeType.remoteRDS,
                },
            ],
        },
        {
            Header: Messages.services.columns.monitoring,
            accessor: 'agentsStatus',
            width: '70px',
            Cell: ({ value, row }) => (React.createElement(StatusLink, { type: "nodes", strippedId: row.original.nodeId === 'pmm-server' ? 'pmm-server' : stripNodeId(row.original.nodeId), agentsStatus: value })),
            type: FilterFieldTypes.RADIO_BUTTON,
            options: [
                {
                    label: MonitoringStatus.OK,
                    value: MonitoringStatus.OK,
                },
                {
                    label: MonitoringStatus.FAILED,
                    value: MonitoringStatus.FAILED,
                },
            ],
        },
        {
            Header: Messages.nodes.columns.address,
            accessor: 'address',
            type: FilterFieldTypes.TEXT,
        },
        {
            Header: Messages.nodes.columns.services,
            accessor: 'services',
            Cell: ({ value, row }) => {
                if (!value || value.length < 1) {
                    return React.createElement("div", null, Messages.nodes.noServices);
                }
                if (value.length === 1) {
                    return (React.createElement(Link, { className: styles.link, href: getServiceLink(value[0].serviceId), onClick: clearClusterToggle }, value[0].serviceName));
                }
                return React.createElement("div", null, Messages.nodes.servicesCount(value.length));
            },
        },
        getExpandAndActionsCol(getActions),
    ], [styles, getActions, clearClusterToggle]);
    const loadData = useCallback(() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield dispatch(fetchNodesAction({ token: generateToken(GET_NODES_CANCEL_TOKEN) })).unwrap();
        }
        catch (e) {
            if (isApiCancelError(e)) {
                return;
            }
            logger.error(e);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), []);
    const renderSelectedSubRow = React.useCallback((row) => {
        const labels = row.original.customLabels || {};
        const labelKeys = Object.keys(labels);
        const extraProperties = row.original.properties || {};
        const extraPropertiesKeys = Object.keys(extraProperties);
        const agents = row.original.agents || [];
        return (React.createElement(DetailsRow, null,
            !!agents.length && (React.createElement(DetailsRow.Contents, { title: Messages.services.details.agents },
                React.createElement(StatusBadge, { type: "nodes", strippedId: row.original.nodeId === 'pmm-server' ? 'pmm-server' : stripNodeId(row.original.nodeId), agents: row.original.agents || [] }))),
            React.createElement(DetailsRow.Contents, { title: Messages.nodes.details.nodeId },
                React.createElement("span", null, row.original.nodeId)),
            row.original.services && row.original.services.length && (React.createElement(DetailsRow.Contents, { title: Messages.nodes.details.serviceNames }, row.original.services.map((service) => (React.createElement("div", { key: service.serviceId },
                React.createElement(Link, { className: styles.link, href: getServiceLink(service.serviceId), onClick: clearClusterToggle }, service.serviceName)))))),
            !!labelKeys.length && (React.createElement(DetailsRow.Contents, { title: Messages.services.details.labels, fullRow: true },
                React.createElement(TagList, { colorIndex: 9, className: styles.tagList, tags: labelKeys.map((label) => `${label}=${labels[label]}`) }))),
            !!extraPropertiesKeys.length && (React.createElement(DetailsRow.Contents, { title: Messages.services.details.properties, fullRow: true },
                React.createElement(TagList, { colorIndex: 9, className: styles.tagList, tags: extraPropertiesKeys.map((prop) => `${prop}=${extraProperties[prop]}`) })))));
    }, [styles.tagList, styles.link, clearClusterToggle]);
    const deletionMsg = useMemo(() => {
        const nodesToDelete = actionItem ? [actionItem] : selected;
        return Messages.nodes.deleteConfirmation(nodesToDelete.length);
    }, [actionItem, selected]);
    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const removeNodes = useCallback((forceMode) => __awaiter(void 0, void 0, void 0, function* () {
        const nodesToDelete = actionItem ? [actionItem] : selected.map((s) => s.original);
        try {
            // eslint-disable-next-line max-len
            const requests = nodesToDelete.map((node) => ({
                nodeId: node.nodeId,
                force: forceMode,
            }));
            const successfullyDeleted = yield dispatch(removeNodesAction({ nodes: requests })).unwrap();
            if (successfullyDeleted > 0) {
                appEvents.emit(AppEvents.alertSuccess, [
                    Messages.nodes.nodesDeleted(successfullyDeleted, nodesToDelete.length),
                ]);
            }
        }
        catch (e) {
            if (isApiCancelError(e)) {
                return;
            }
            logger.error(e);
        }
        if (actionItem) {
            setActionItem(null);
        }
        else {
            setSelectedRows([]);
        }
        loadData();
    }), [actionItem, dispatch, loadData, selected]);
    const proceed = useCallback((values) => __awaiter(void 0, void 0, void 0, function* () {
        yield removeNodes(values.force);
        setModalVisible(false);
    }), [removeNodes]);
    const handleSelectionChange = useCallback((rows) => {
        setSelectedRows(rows);
    }, []);
    return (React.createElement(OldPage, { navModel: navModel },
        React.createElement(OldPage.Contents, null,
            React.createElement(FeatureLoader, null,
                React.createElement("div", { className: styles.actionPanel },
                    React.createElement(Button, { size: "md", disabled: selected.length === 0, onClick: () => {
                            setModalVisible(!modalVisible);
                        }, icon: "trash-alt", variant: "destructive" }, Messages.delete)),
                React.createElement(Modal, { title: React.createElement("div", { className: "modal-header-title" },
                        React.createElement("span", { className: "p-l-1" }, Messages.confirmAction)), isOpen: modalVisible, onDismiss: () => setModalVisible(false) },
                    React.createElement(Form, { onSubmit: proceed, render: ({ handleSubmit }) => (React.createElement("form", { onSubmit: handleSubmit },
                            React.createElement(React.Fragment, null,
                                React.createElement("h4", { className: styles.confirmationText }, deletionMsg),
                                React.createElement(FormElement, { dataTestId: "form-field-force", label: Messages.forceMode, element: React.createElement(CheckboxField, { name: "force", label: Messages.nodes.forceConfirmation }) }),
                                React.createElement(HorizontalGroup, { justify: "space-between", spacing: "md" },
                                    React.createElement(Button, { variant: "secondary", size: "md", onClick: () => setModalVisible(false) }, Messages.cancel),
                                    React.createElement(Button, { type: "submit", size: "md", variant: "destructive" }, Messages.proceed))))) })),
                React.createElement(Table, { columns: columns, data: nodes, totalItems: nodes.length, rowSelection: true, autoResetSelectedRows: false, onRowSelection: handleSelectionChange, showPagination: true, pageSize: 25, allRowsSelectionMode: "page", emptyMessage: Messages.nodes.emptyTable, pendingRequest: isLoading, overlayClassName: styles.overlay, renderExpandedRow: renderSelectedSubRow, getRowId: useCallback((row) => row.nodeId, []), showFilter: true })))));
};
export default NodesTab;
//# sourceMappingURL=Nodes.js.map