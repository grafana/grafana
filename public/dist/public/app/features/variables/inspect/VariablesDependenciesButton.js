import { __assign } from "tslib";
import React, { useMemo } from 'react';
import { Provider } from 'react-redux';
// @ts-ignore
import { Button } from '@grafana/ui';
import { createDependencyEdges, createDependencyNodes, filterNodesWithDependencies } from './utils';
import { store } from '../../../store/store';
import { NetworkGraphModal } from './NetworkGraphModal';
export var UnProvidedVariablesDependenciesButton = function (_a) {
    var variables = _a.variables;
    var nodes = useMemo(function () { return createDependencyNodes(variables); }, [variables]);
    var edges = useMemo(function () { return createDependencyEdges(variables); }, [variables]);
    if (!edges.length) {
        return null;
    }
    return (React.createElement(NetworkGraphModal, { show: false, title: "Dependencies", nodes: filterNodesWithDependencies(nodes, edges), edges: edges }, function (_a) {
        var showModal = _a.showModal;
        return (React.createElement(Button, { onClick: function () { return showModal(); }, icon: "channel-add", variant: "secondary" }, "Show dependencies"));
    }));
};
export var VariablesDependenciesButton = function (props) { return (React.createElement(Provider, { store: store },
    React.createElement(UnProvidedVariablesDependenciesButton, __assign({}, props)))); };
//# sourceMappingURL=VariablesDependenciesButton.js.map