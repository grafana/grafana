import { useDialog } from '@react-aria/dialog';
import { useOverlay } from '@react-aria/overlays';
import React, { createRef } from 'react';
import { Portal, VizTooltipContainer } from '@grafana/ui';
import { ComplexDataHoverView } from 'app/features/visualization/data-hover/ComplexDataHoverView';
export const GeomapTooltip = ({ ttip, onClose, isOpen }) => {
    const ref = createRef();
    const { overlayProps } = useOverlay({ onClose, isDismissable: true, isOpen }, ref);
    const { dialogProps } = useDialog({}, ref);
    return (React.createElement(React.Fragment, null, ttip && ttip.layers && (React.createElement(Portal, null,
        React.createElement(VizTooltipContainer, { position: { x: ttip.pageX, y: ttip.pageY }, offset: { x: 10, y: 10 }, allowPointerEvents: true },
            React.createElement("section", Object.assign({ ref: ref }, overlayProps, dialogProps),
                React.createElement(ComplexDataHoverView, { layers: ttip.layers, isOpen: isOpen, onClose: onClose })))))));
};
//# sourceMappingURL=GeomapTooltip.js.map