import React, { useCallback, useEffect, useState } from 'react';
import { Collapse, HorizontalGroup, Icon } from '@grafana/ui';
import { DATABASE_ICONS } from 'app/percona/shared/core';
import { removeClusterFilters, shouldClusterBeExpanded } from './Clusters.utils';
import ServicesTable from './ServicesTable';
const ClusterItem = ({ cluster, onDelete, onSelectionChange }) => {
    const [isOpen, setIsOpen] = useState(shouldClusterBeExpanded(cluster.name));
    const icon = cluster.type ? DATABASE_ICONS[cluster.type] : 'database';
    const handleSelectionChange = useCallback((services) => {
        onSelectionChange(cluster, services);
    }, [cluster, onSelectionChange]);
    useEffect(() => {
        if (!isOpen) {
            removeClusterFilters(cluster.name);
        }
    }, [isOpen, cluster.name]);
    return (React.createElement(Collapse, { collapsible: true, label: React.createElement(HorizontalGroup, null,
            !!icon && React.createElement(Icon, { name: icon, "data-testid": "service-icon" }),
            React.createElement("span", null, cluster.name)), isOpen: isOpen, onToggle: () => setIsOpen(!isOpen) },
        React.createElement(ServicesTable, { flattenServices: cluster.services, isLoading: false, onDelete: onDelete, onSelectionChange: handleSelectionChange, tableKey: cluster.name, showPagination: false })));
};
export default ClusterItem;
//# sourceMappingURL=ClusterItem.js.map