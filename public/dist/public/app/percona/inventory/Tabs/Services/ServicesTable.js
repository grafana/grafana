import React, { useCallback, useMemo } from 'react';
import { locationService } from '@grafana/runtime';
import { Badge, HorizontalGroup, Icon, Link, TagList, useStyles2 } from '@grafana/ui';
import { DetailsRow } from 'app/percona/shared/components/Elements/DetailsRow/DetailsRow';
import { ServiceIconWithText } from 'app/percona/shared/components/Elements/ServiceIconWithText/ServiceIconWithText';
import { FilterFieldTypes, Table } from 'app/percona/shared/components/Elements/Table';
import { getDashboardLinkForService } from 'app/percona/shared/helpers/getDashboardLinkForService';
import { getExpandAndActionsCol } from 'app/percona/shared/helpers/getExpandAndActionsCol';
import { ServiceStatus } from 'app/percona/shared/services/services/Services.types';
import { Messages } from '../../Inventory.messages';
import { MonitoringStatus } from '../../Inventory.types';
import { StatusBadge } from '../../components/StatusBadge/StatusBadge';
import { StatusInfo } from '../../components/StatusInfo/StatusInfo';
import { StatusLink } from '../../components/StatusLink/StatusLink';
import { getBadgeColorForServiceStatus, getBadgeTextForServiceStatus, getBadgeIconForServiceStatus, getNodeLink, stripServiceId, } from '../Services.utils';
import { getStyles } from '../Tabs.styles';
const ServicesTable = ({ isLoading, flattenServices, onSelectionChange, onDelete, tableKey, showPagination = true, }) => {
    const styles = useStyles2(getStyles);
    const getActions = useCallback((row) => [
        {
            content: (React.createElement(HorizontalGroup, { spacing: "sm" },
                React.createElement(Icon, { name: "trash-alt" }),
                React.createElement("span", { className: styles.actionItemTxtSpan }, Messages.delete))),
            action: () => {
                onDelete(row.original);
            },
        },
        {
            content: (React.createElement(HorizontalGroup, { spacing: "sm" },
                React.createElement(Icon, { name: "pen" }),
                React.createElement("span", { className: styles.actionItemTxtSpan }, Messages.edit))),
            action: () => {
                const serviceId = row.original.serviceId.split('/').pop();
                locationService.push(`/edit-instance/${serviceId}`);
            },
        },
        {
            content: Messages.services.actions.dashboard,
            action: () => {
                locationService.push(getDashboardLinkForService(row.original.type, row.original.serviceName));
            },
        },
        {
            content: Messages.services.actions.qan,
            action: () => {
                locationService.push(`/d/pmm-qan/pmm-query-analytics?var-service_name=${row.original.serviceName}`);
            },
        },
    ], [styles.actionItemTxtSpan, onDelete]);
    const columns = useMemo(() => [
        {
            Header: Messages.services.columns.serviceId,
            id: 'serviceId',
            accessor: 'serviceId',
            hidden: true,
            type: FilterFieldTypes.TEXT,
        },
        {
            Header: Messages.services.columns.status,
            accessor: 'status',
            Cell: ({ value }) => (React.createElement(Badge, { text: getBadgeTextForServiceStatus(value), color: getBadgeColorForServiceStatus(value), icon: getBadgeIconForServiceStatus(value) })),
            tooltipInfo: React.createElement(StatusInfo, null),
            type: FilterFieldTypes.DROPDOWN,
            options: [
                {
                    label: 'Up',
                    value: ServiceStatus.UP,
                },
                {
                    label: 'Down',
                    value: ServiceStatus.DOWN,
                },
                {
                    label: 'Unknown',
                    value: ServiceStatus.UNKNOWN,
                },
                {
                    label: 'N/A',
                    value: ServiceStatus.NA,
                },
            ],
        },
        {
            Header: Messages.services.columns.serviceName,
            accessor: 'serviceName',
            Cell: ({ value, row }) => (React.createElement(ServiceIconWithText, { text: value, dbType: row.original.type })),
            type: FilterFieldTypes.TEXT,
        },
        {
            Header: Messages.services.columns.nodeName,
            accessor: 'nodeName',
            Cell: ({ value, row }) => (React.createElement(Link, { className: styles.link, href: getNodeLink(row.original) }, value)),
            type: FilterFieldTypes.TEXT,
        },
        {
            Header: Messages.services.columns.monitoring,
            accessor: 'agentsStatus',
            width: '70px',
            Cell: ({ value, row }) => (React.createElement(StatusLink, { type: "services", strippedId: stripServiceId(row.original.serviceId), agentsStatus: value })),
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
            Header: Messages.services.columns.address,
            accessor: 'address',
            type: FilterFieldTypes.TEXT,
        },
        {
            Header: Messages.services.columns.port,
            accessor: 'port',
            width: '100px',
            type: FilterFieldTypes.TEXT,
        },
        getExpandAndActionsCol(getActions),
    ], [styles, getActions]);
    const renderSelectedSubRow = React.useCallback((row) => {
        const labels = row.original.customLabels || {};
        const labelKeys = Object.keys(labels);
        const agents = row.original.agents || [];
        return (React.createElement(DetailsRow, null,
            !!agents.length && (React.createElement(DetailsRow.Contents, { title: Messages.services.details.agents },
                React.createElement(StatusBadge, { strippedId: stripServiceId(row.original.serviceId), type: 'services', agents: row.original.agents || [] }))),
            React.createElement(DetailsRow.Contents, { title: Messages.services.details.serviceId },
                React.createElement("span", null, row.original.serviceId)),
            !!labelKeys.length && (React.createElement(DetailsRow.Contents, { title: Messages.services.details.labels, fullRow: true },
                React.createElement(TagList, { colorIndex: 9, className: styles.tagList, tags: labelKeys.map((label) => `${label}=${labels[label]}`) })))));
    }, [styles.tagList]);
    return (React.createElement(Table, { columns: columns, data: flattenServices, totalItems: flattenServices.length, rowSelection: true, onRowSelection: onSelectionChange, showPagination: showPagination, pageSize: 25, allRowsSelectionMode: "page", emptyMessage: Messages.services.emptyTable, pendingRequest: isLoading, overlayClassName: styles.overlay, renderExpandedRow: renderSelectedSubRow, autoResetSelectedRows: false, getRowId: useCallback((row) => row.serviceId, []), showFilter: true, tableKey: tableKey }));
};
export default ServicesTable;
//# sourceMappingURL=ServicesTable.js.map