import React, { useMemo } from 'react';
import { Provider } from 'react-redux';
import { reportInteraction } from '@grafana/runtime';
import { Button } from '@grafana/ui';
import { store } from '../../../store/store';
import { NetworkGraphModal } from './NetworkGraphModal';
import { createDependencyEdges, createDependencyNodes, filterNodesWithDependencies } from './utils';
export const UnProvidedVariablesDependenciesButton = ({ variables }) => {
    const nodes = useMemo(() => createDependencyNodes(variables), [variables]);
    const edges = useMemo(() => createDependencyEdges(variables), [variables]);
    if (!edges.length) {
        return null;
    }
    return (React.createElement(NetworkGraphModal, { show: false, title: "Dependencies", nodes: filterNodesWithDependencies(nodes, edges), edges: edges }, ({ showModal }) => {
        return (React.createElement(Button, { onClick: () => {
                reportInteraction('Show variable dependencies');
                showModal();
            }, icon: "channel-add", variant: "secondary" }, "Show dependencies"));
    }));
};
export const VariablesDependenciesButton = (props) => (React.createElement(Provider, { store: store },
    React.createElement(UnProvidedVariablesDependenciesButton, Object.assign({}, props))));
//# sourceMappingURL=VariablesDependenciesButton.js.map