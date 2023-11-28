import React from 'react';
import Skeleton from 'react-loading-skeleton';
import { Alert, Text } from '@grafana/ui';
import { useGetAffectedItemsQuery } from '../../api/browseDashboardsAPI';
import { buildBreakdownString } from './utils';
export const DescendantCount = ({ selectedItems }) => {
    const { data, isFetching, isLoading, error } = useGetAffectedItemsQuery(selectedItems);
    return (React.createElement(React.Fragment, null,
        React.createElement(Text, { element: "p", color: "secondary" },
            data && buildBreakdownString(data.folder, data.dashboard, data.libraryPanel, data.alertRule),
            (isFetching || isLoading) && React.createElement(Skeleton, { width: 200 })),
        error && React.createElement(Alert, { severity: "error", title: "Unable to retrieve descendant information" })));
};
//# sourceMappingURL=DescendantCount.js.map