import { __assign } from "tslib";
import React, { useMemo } from 'react';
import { IconButton } from '@grafana/ui';
import { NetworkGraphModal } from './NetworkGraphModal';
export var VariablesUnknownButton = function (_a) {
    var id = _a.id, usages = _a.usages;
    var network = useMemo(function () { return usages.find(function (n) { return n.variable.id === id; }); }, [id, usages]);
    if (!network) {
        return null;
    }
    var nodes = network.nodes.map(function (n) {
        if (n.label.includes("$" + id)) {
            return __assign(__assign({}, n), { color: '#FB7E81' });
        }
        return n;
    });
    return (React.createElement(NetworkGraphModal, { show: false, title: "Showing usages for: $" + id, nodes: nodes, edges: network.edges }, function (_a) {
        var showModal = _a.showModal;
        return React.createElement(IconButton, { onClick: function () { return showModal(); }, name: "code-branch", title: "Show usages" });
    }));
};
//# sourceMappingURL=VariablesUnknownButton.js.map