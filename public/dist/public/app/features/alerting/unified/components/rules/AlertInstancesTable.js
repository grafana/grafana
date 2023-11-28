import React, { useMemo } from 'react';
import { dateTime, findCommonLabels } from '@grafana/data';
import { alertInstanceKey } from '../../utils/rules';
import { AlertLabels } from '../AlertLabels';
import { DynamicTable } from '../DynamicTable';
import { AlertInstanceDetails } from './AlertInstanceDetails';
import { AlertStateTag } from './AlertStateTag';
export const AlertInstancesTable = ({ instances, pagination, footerRow }) => {
    const commonLabels = useMemo(() => {
        // only compute the common labels if we have more than 1 instance, if we don't then that single instance
        // will have the complete set of common labels and no unique ones
        return instances.length > 1 ? findCommonLabels(instances.map((instance) => instance.labels)) : {};
    }, [instances]);
    const items = useMemo(() => instances.map((instance) => ({
        data: Object.assign(Object.assign({}, instance), { commonLabels }),
        id: alertInstanceKey(instance),
    })), [commonLabels, instances]);
    return (React.createElement(DynamicTable, { cols: columns, isExpandable: true, items: items, renderExpandedContent: ({ data }) => React.createElement(AlertInstanceDetails, { instance: data }), pagination: pagination, footerRow: footerRow }));
};
const columns = [
    {
        id: 'state',
        label: 'State',
        // eslint-disable-next-line react/display-name
        renderCell: ({ data: { state } }) => React.createElement(AlertStateTag, { state: state }),
        size: '80px',
    },
    {
        id: 'labels',
        label: 'Labels',
        // eslint-disable-next-line react/display-name
        renderCell: ({ data: { labels, commonLabels } }) => (React.createElement(AlertLabels, { labels: labels, commonLabels: commonLabels, size: "sm" })),
    },
    {
        id: 'created',
        label: 'Created',
        // eslint-disable-next-line react/display-name
        renderCell: ({ data: { activeAt } }) => (React.createElement(React.Fragment, null, activeAt.startsWith('0001') ? '-' : dateTime(activeAt).format('YYYY-MM-DD HH:mm:ss'))),
        size: '150px',
    },
];
//# sourceMappingURL=AlertInstancesTable.js.map