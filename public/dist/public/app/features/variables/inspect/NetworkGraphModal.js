import React, { useCallback, useState } from 'react';
import { Modal } from '@grafana/ui';
import { NetworkGraph } from './NetworkGraph';
export function NetworkGraphModal({ edges, nodes, show: propsShow, title, children }) {
    const [show, setShow] = useState(propsShow);
    const showModal = useCallback(() => setShow(true), [setShow]);
    const onClose = useCallback(() => setShow(false), [setShow]);
    return (React.createElement(React.Fragment, null,
        React.createElement(Modal, { isOpen: show, title: title, icon: "info-circle", iconTooltip: "The graph can be moved, zoomed in, and zoomed out.", onClickBackdrop: onClose, onDismiss: onClose },
            React.createElement(NetworkGraph, { nodes: nodes, edges: edges })),
        children({ showModal })));
}
//# sourceMappingURL=NetworkGraphModal.js.map