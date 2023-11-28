import React, { useMemo } from 'react';
import { reportInteraction } from '@grafana/runtime';
import { IconButton } from '@grafana/ui';
import { NetworkGraphModal } from './NetworkGraphModal';
export const VariableUsagesButton = ({ id, usages, isAdhoc }) => {
    const network = useMemo(() => usages.find((n) => n.variable.id === id), [usages, id]);
    if (usages.length === 0 || isAdhoc || !network) {
        return null;
    }
    const nodes = network.nodes.map((n) => {
        if (n.label.includes(`$${id}`)) {
            return Object.assign(Object.assign({}, n), { color: '#FB7E81' });
        }
        return n;
    });
    return (React.createElement(NetworkGraphModal, { show: false, title: `Showing usages for: $${id}`, nodes: nodes, edges: network.edges }, ({ showModal }) => {
        return (React.createElement(IconButton, { onClick: () => {
                reportInteraction('Show variable usages');
                showModal();
            }, name: "code-branch", tooltip: "Show usages" }));
    }));
};
//# sourceMappingURL=VariableUsagesButton.js.map