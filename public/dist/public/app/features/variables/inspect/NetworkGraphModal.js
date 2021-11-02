import { __read } from "tslib";
import React, { useCallback, useState } from 'react';
import { Modal } from '@grafana/ui';
import { NetworkGraph } from './NetworkGraph';
export function NetworkGraphModal(_a) {
    var edges = _a.edges, nodes = _a.nodes, propsShow = _a.show, title = _a.title, children = _a.children;
    var _b = __read(useState(propsShow), 2), show = _b[0], setShow = _b[1];
    var showModal = useCallback(function () { return setShow(true); }, [setShow]);
    var onClose = useCallback(function () { return setShow(false); }, [setShow]);
    return (React.createElement(React.Fragment, null,
        React.createElement(Modal, { isOpen: show, title: title, icon: "info-circle", iconTooltip: "The graph can be moved, zoomed in, and zoomed out.", onClickBackdrop: onClose, onDismiss: onClose },
            React.createElement(NetworkGraph, { nodes: nodes, edges: edges })),
        children({ showModal: showModal })));
}
//# sourceMappingURL=NetworkGraphModal.js.map