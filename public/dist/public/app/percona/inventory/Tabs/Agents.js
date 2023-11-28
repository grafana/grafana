import { __awaiter } from "tslib";
/* eslint-disable @typescript-eslint/consistent-type-assertions,@typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Form } from 'react-final-form';
import { AppEvents } from '@grafana/data';
import { Badge, Button, HorizontalGroup, Icon, Link, Modal, TagList, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { formatServiceId } from 'app/percona/check/components/FailedChecksTab/FailedChecksTab.utils';
import { ServiceAgentStatus } from 'app/percona/inventory/Inventory.types';
import { CheckboxField } from 'app/percona/shared/components/Elements/Checkbox';
import { DetailsRow } from 'app/percona/shared/components/Elements/DetailsRow/DetailsRow';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { FilterFieldTypes, Table } from 'app/percona/shared/components/Elements/Table';
import { FormElement } from 'app/percona/shared/components/Form';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { fetchNodesAction } from 'app/percona/shared/core/reducers/nodes/nodes';
import { fetchServicesAction } from 'app/percona/shared/core/reducers/services';
import { getNodes, getServices } from 'app/percona/shared/core/selectors';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { capitalizeText } from 'app/percona/shared/helpers/capitalizeText';
import { getExpandAndActionsCol } from 'app/percona/shared/helpers/getExpandAndActionsCol';
import { logger } from 'app/percona/shared/helpers/logger';
import { filterFulfilled, processPromiseResults } from 'app/percona/shared/helpers/promises';
import { dispatch } from 'app/store/store';
import { useSelector } from 'app/types';
import { appEvents } from '../../../core/app_events';
import { GET_AGENTS_CANCEL_TOKEN, GET_NODES_CANCEL_TOKEN, GET_SERVICES_CANCEL_TOKEN } from '../Inventory.constants';
import { Messages } from '../Inventory.messages';
import { InventoryService } from '../Inventory.service';
import { beautifyAgentType, getAgentStatusColor, toAgentModel } from './Agents.utils';
import { formatNodeId } from './Nodes.utils';
import { getStyles } from './Tabs.styles';
export const Agents = ({ match }) => {
    const [agentsLoading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [data, setData] = useState([]);
    const [selected, setSelectedRows] = useState([]);
    const serviceId = match.params.serviceId ? formatServiceId(match.params.serviceId) : undefined;
    const nodeId = match.params.nodeId
        ? match.params.nodeId === 'pmm-server'
            ? 'pmm-server'
            : formatNodeId(match.params.nodeId)
        : undefined;
    const navModel = usePerconaNavModel(serviceId ? 'inventory-services' : 'inventory-nodes');
    const [generateToken] = useCancelToken();
    const { isLoading: servicesLoading, services } = useSelector(getServices);
    const { isLoading: nodesLoading, nodes } = useSelector(getNodes);
    const styles = useStyles2(getStyles);
    const service = services.find((s) => s.params.serviceId === serviceId);
    const node = nodes.find((s) => s.nodeId === nodeId);
    const flattenAgents = useMemo(() => data.map((value) => (Object.assign({ type: value.type }, value.params))), [data]);
    const columns = useMemo(() => [
        {
            Header: Messages.agents.columns.status,
            accessor: 'status',
            Cell: ({ value }) => (React.createElement(Badge, { text: capitalizeText(value), color: getAgentStatusColor(value) })),
            type: FilterFieldTypes.DROPDOWN,
            options: [
                {
                    label: 'Done',
                    value: ServiceAgentStatus.DONE,
                },
                {
                    label: 'Running',
                    value: ServiceAgentStatus.RUNNING,
                },
                {
                    label: 'Starting',
                    value: ServiceAgentStatus.STARTING,
                },
                {
                    label: 'Stopping',
                    value: ServiceAgentStatus.STOPPING,
                },
                {
                    label: 'Unknown',
                    value: ServiceAgentStatus.UNKNOWN,
                },
                {
                    label: 'Waiting',
                    value: ServiceAgentStatus.WAITING,
                },
            ],
        },
        {
            Header: Messages.agents.columns.agentType,
            accessor: 'type',
            Cell: ({ value }) => React.createElement(React.Fragment, null, beautifyAgentType(value)),
            type: FilterFieldTypes.TEXT,
        },
        {
            Header: Messages.agents.columns.agentId,
            accessor: 'agentId',
            type: FilterFieldTypes.TEXT,
        },
        getExpandAndActionsCol(),
    ], []);
    const loadData = useCallback(() => __awaiter(void 0, void 0, void 0, function* () {
        setLoading(true);
        try {
            const { agents = [] } = yield InventoryService.getAgents(serviceId, nodeId, generateToken(GET_AGENTS_CANCEL_TOKEN));
            setData(toAgentModel(agents));
        }
        catch (e) {
            if (isApiCancelError(e)) {
                return;
            }
            logger.error(e);
        }
        setLoading(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), []);
    const renderSelectedSubRow = React.useCallback((row) => {
        const labels = row.original.customLabels || {};
        const labelKeys = Object.keys(labels);
        return (React.createElement(DetailsRow, null, !!labelKeys.length && (React.createElement(DetailsRow.Contents, { title: Messages.agents.details.properties, fullRow: true },
            React.createElement(TagList, { colorIndex: 9, className: styles.tagList, tags: labelKeys.map((label) => `${label}=${labels[label]}`) })))));
    }, [styles.tagList]);
    const deletionMsg = useMemo(() => Messages.agents.deleteConfirmation(selected.length), [selected]);
    useEffect(() => {
        if (!service && serviceId) {
            dispatch(fetchServicesAction({ token: generateToken(GET_SERVICES_CANCEL_TOKEN) }));
        }
        else if (!node && nodeId) {
            dispatch(fetchNodesAction({ token: generateToken(GET_NODES_CANCEL_TOKEN) }));
        }
        else {
            loadData();
        }
    }, [generateToken, loadData, service, nodeId, serviceId, node]);
    const removeAgents = useCallback((agents, forceMode) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            setLoading(true);
            // eslint-disable-next-line max-len
            const requests = agents.map((agent) => InventoryService.removeAgent({ agent_id: agent.original.agentId, force: forceMode }));
            const results = yield processPromiseResults(requests);
            const successfullyDeleted = results.filter(filterFulfilled).length;
            if (successfullyDeleted > 0) {
                appEvents.emit(AppEvents.alertSuccess, [Messages.agents.agentsDeleted(successfullyDeleted, agents.length)]);
            }
        }
        catch (e) {
            if (isApiCancelError(e)) {
                return;
            }
            logger.error(e);
        }
        setSelectedRows([]);
        loadData();
    }), [loadData]);
    const handleSelectionChange = useCallback((rows) => {
        setSelectedRows(rows);
    }, []);
    return (React.createElement(Page, { navModel: navModel },
        React.createElement(Page.Contents, null,
            React.createElement(FeatureLoader, null,
                React.createElement(HorizontalGroup, { height: "auto" },
                    React.createElement(Link, { href: `${service ? '/inventory/services' : '/inventory/nodes'}` },
                        React.createElement(Icon, { name: "arrow-left", size: "lg" }),
                        React.createElement("span", { className: styles.goBack }, service ? Messages.agents.goBackToServices : Messages.agents.goBackToNodes))),
                service && !servicesLoading && (React.createElement("h5", { className: styles.agentBreadcrumb },
                    React.createElement("span", null, Messages.agents.breadcrumbLeftService(service.params.serviceName)),
                    React.createElement("span", null, Messages.agents.breadcrumbRight))),
                node && !nodesLoading && (React.createElement("h5", { className: styles.agentBreadcrumb },
                    React.createElement("span", null, Messages.agents.breadcrumbLeftNode(node.nodeName)),
                    React.createElement("span", null, Messages.agents.breadcrumbRight))),
                React.createElement(HorizontalGroup, { height: 40, justify: "flex-end", align: "flex-start" },
                    React.createElement(Button, { size: "md", disabled: selected.length === 0, onClick: () => {
                            setModalVisible((visible) => !visible);
                        }, icon: "trash-alt", variant: "destructive" }, Messages.delete)),
                React.createElement(Modal, { title: React.createElement("div", { className: "modal-header-title" },
                        React.createElement("span", { className: "p-l-1" }, "Confirm action")), isOpen: modalVisible, onDismiss: () => setModalVisible(false) },
                    React.createElement(Form, { onSubmit: () => { }, render: ({ form, handleSubmit }) => (React.createElement("form", { onSubmit: handleSubmit },
                            React.createElement(React.Fragment, null,
                                React.createElement("h4", { className: styles.confirmationText }, deletionMsg),
                                React.createElement(FormElement, { dataTestId: "form-field-force", label: Messages.forceMode, element: React.createElement(CheckboxField, { name: "force", label: Messages.agents.forceConfirmation }) }),
                                React.createElement(HorizontalGroup, { justify: "space-between", spacing: "md" },
                                    React.createElement(Button, { variant: "secondary", size: "md", onClick: () => setModalVisible(false) }, Messages.cancel),
                                    React.createElement(Button, { size: "md", onClick: () => {
                                            removeAgents(selected, form.getState().values.force);
                                            setModalVisible(false);
                                        }, variant: "destructive" }, Messages.proceed))))) })),
                React.createElement(Table, { columns: columns, data: flattenAgents, totalItems: flattenAgents.length, rowSelection: true, autoResetSelectedRows: false, onRowSelection: handleSelectionChange, showPagination: true, pageSize: 25, allRowsSelectionMode: "page", emptyMessage: Messages.agents.emptyTable, emptyMessageClassName: styles.emptyMessage, pendingRequest: agentsLoading || servicesLoading || nodesLoading, overlayClassName: styles.overlay, renderExpandedRow: renderSelectedSubRow, getRowId: useCallback((row) => row.agentId, []), showFilter: true })))));
};
export default Agents;
//# sourceMappingURL=Agents.js.map