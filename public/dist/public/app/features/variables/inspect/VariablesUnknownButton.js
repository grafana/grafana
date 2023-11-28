import React, { useMemo } from 'react';
import { IconButton } from '@grafana/ui';
import { NetworkGraphModal } from './NetworkGraphModal';
export const VariablesUnknownButton = ({ id, usages }) => {
    const network = useMemo(() => usages.find((n) => n.variable.id === id), [id, usages]);
    if (!network) {
        return null;
    }
    const nodes = network.nodes.map((n) => {
        if (n.label.includes(`$${id}`)) {
            return Object.assign(Object.assign({}, n), { color: '#FB7E81' });
        }
        return n;
    });
    return (React.createElement(NetworkGraphModal, { show: false, title: `Showing usages for: $${id}`, nodes: nodes, edges: network.edges }, ({ showModal }) => {
        return (React.createElement(IconButton, { onClick: () => showModal(), name: "code-branch", tooltip: "Show usages", "data-testid": "VariablesUnknownButton" }));
    }));
};
//# sourceMappingURL=VariablesUnknownButton.js.map