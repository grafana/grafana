import React, { useCallback, useMemo, useState } from 'react';
import ClusterItem from './ClusterItem';
import { getClustersFromServices } from './Clusters.utils';
const Clusters = ({ services, onDelete, onSelectionChange }) => {
    const clusters = useMemo(() => getClustersFromServices(services), [services]);
    const [selection, setSelection] = useState({});
    const handleSelectionChange = useCallback((cluster, selectedServices) => {
        const selectionByClusters = Object.assign(Object.assign({}, selection), { [cluster.name]: selectedServices });
        const selected = Object.values(selectionByClusters).flat();
        setSelection(selectionByClusters);
        onSelectionChange(selected);
    }, 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onSelectionChange]);
    return (React.createElement("div", null, clusters.map((cluster) => (React.createElement(ClusterItem, { key: cluster.name, cluster: cluster, onDelete: onDelete, onSelectionChange: handleSelectionChange })))));
};
export default Clusters;
//# sourceMappingURL=Clusters.js.map