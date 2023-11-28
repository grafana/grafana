import { css } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { useOverlay } from '@react-aria/overlays';
import React, { createRef } from 'react';
import { LinkButton, Portal, useStyles2, VerticalGroup, VizTooltipContainer } from '@grafana/ui';
import { CloseButton } from 'app/core/components/CloseButton/CloseButton';
export const CanvasTooltip = ({ scene }) => {
    var _a, _b;
    const style = useStyles2(getStyles);
    const onClose = () => {
        if ((scene === null || scene === void 0 ? void 0 : scene.tooltipCallback) && scene.tooltip) {
            scene.tooltipCallback(undefined);
        }
    };
    const ref = createRef();
    const { overlayProps } = useOverlay({ onClose: onClose, isDismissable: true }, ref);
    const { dialogProps } = useDialog({}, ref);
    const element = (_a = scene.tooltip) === null || _a === void 0 ? void 0 : _a.element;
    if (!element) {
        return React.createElement(React.Fragment, null);
    }
    const renderDataLinks = () => {
        var _a, _b, _c, _d;
        return ((_a = element.data) === null || _a === void 0 ? void 0 : _a.links) &&
            ((_b = element.data) === null || _b === void 0 ? void 0 : _b.links.length) > 0 && (React.createElement("div", null,
            React.createElement(VerticalGroup, null, (_d = (_c = element.data) === null || _c === void 0 ? void 0 : _c.links) === null || _d === void 0 ? void 0 : _d.map((link, i) => (React.createElement(LinkButton, { key: i, icon: 'external-link-alt', target: link.target, href: link.href, onClick: link.onClick, fill: "text", style: { width: '100%' } }, link.title))))));
    };
    return (React.createElement(React.Fragment, null, ((_b = scene.tooltip) === null || _b === void 0 ? void 0 : _b.element) && scene.tooltip.anchorPoint && (React.createElement(Portal, null,
        React.createElement(VizTooltipContainer, { position: { x: scene.tooltip.anchorPoint.x, y: scene.tooltip.anchorPoint.y }, offset: { x: 5, y: 0 }, allowPointerEvents: scene.tooltip.isOpen },
            React.createElement("section", Object.assign({ ref: ref }, overlayProps, dialogProps),
                scene.tooltip.isOpen && React.createElement(CloseButton, { style: { zIndex: 1 }, onClick: onClose }),
                React.createElement("div", { className: style.wrapper }, renderDataLinks())))))));
};
const getStyles = (theme) => ({
    wrapper: css `
    margin-top: 20px;
    background: ${theme.colors.background.primary};
  `,
});
//# sourceMappingURL=CanvasTooltip.js.map