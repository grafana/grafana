import { css } from '@emotion/css';
import React from 'react';
import { IconButton, useStyles2 } from '@grafana/ui/src';
import { HorizontalConstraint, QuickPlacement, VerticalConstraint } from 'app/features/canvas';
export const QuickPositioning = ({ onPositionChange, element, settings }) => {
    const styles = useStyles2(getStyles);
    const onQuickPositioningChange = (position) => {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const defaultConstraint = { vertical: VerticalConstraint.Top, horizontal: HorizontalConstraint.Left };
        const originalConstraint = Object.assign({}, element.options.constraint);
        element.options.constraint = defaultConstraint;
        element.setPlacementFromConstraint();
        switch (position) {
            case QuickPlacement.Top:
                onPositionChange(0, 'top');
                break;
            case QuickPlacement.Bottom:
                onPositionChange(getRightBottomPosition((_b = (_a = element.options.placement) === null || _a === void 0 ? void 0 : _a.height) !== null && _b !== void 0 ? _b : 0, 'bottom'), 'top');
                break;
            case QuickPlacement.VerticalCenter:
                onPositionChange(getCenterPosition((_d = (_c = element.options.placement) === null || _c === void 0 ? void 0 : _c.height) !== null && _d !== void 0 ? _d : 0, 'v'), 'top');
                break;
            case QuickPlacement.Left:
                onPositionChange(0, 'left');
                break;
            case QuickPlacement.Right:
                onPositionChange(getRightBottomPosition((_f = (_e = element.options.placement) === null || _e === void 0 ? void 0 : _e.width) !== null && _f !== void 0 ? _f : 0, 'right'), 'left');
                break;
            case QuickPlacement.HorizontalCenter:
                onPositionChange(getCenterPosition((_h = (_g = element.options.placement) === null || _g === void 0 ? void 0 : _g.width) !== null && _h !== void 0 ? _h : 0, 'h'), 'left');
                break;
        }
        element.options.constraint = originalConstraint;
        element.setPlacementFromConstraint();
    };
    // Basing this on scene will mean that center is based on root for the time being
    const getCenterPosition = (elementSize, align) => {
        const sceneSize = align === 'h' ? settings.scene.width : settings.scene.height;
        return (sceneSize - elementSize) / 2;
    };
    const getRightBottomPosition = (elementSize, align) => {
        const sceneSize = align === 'right' ? settings.scene.width : settings.scene.height;
        return sceneSize - elementSize;
    };
    return (React.createElement("div", { className: styles.buttonGroup },
        React.createElement(IconButton, { name: "horizontal-align-left", onClick: () => onQuickPositioningChange(QuickPlacement.Left), className: styles.button, size: "lg", tooltip: "Align left" }),
        React.createElement(IconButton, { name: "horizontal-align-center", onClick: () => onQuickPositioningChange(QuickPlacement.HorizontalCenter), className: styles.button, size: "lg", tooltip: "Align horizontal centers" }),
        React.createElement(IconButton, { name: "horizontal-align-right", onClick: () => onQuickPositioningChange(QuickPlacement.Right), className: styles.button, size: "lg", tooltip: "Align right" }),
        React.createElement(IconButton, { name: "vertical-align-top", onClick: () => onQuickPositioningChange(QuickPlacement.Top), size: "lg", tooltip: "Align top" }),
        React.createElement(IconButton, { name: "vertical-align-center", onClick: () => onQuickPositioningChange(QuickPlacement.VerticalCenter), className: styles.button, size: "lg", tooltip: "Align vertical centers" }),
        React.createElement(IconButton, { name: "vertical-align-bottom", onClick: () => onQuickPositioningChange(QuickPlacement.Bottom), className: styles.button, size: "lg", tooltip: "Align bottom" })));
};
const getStyles = (theme) => ({
    buttonGroup: css `
    display: flex;
    flex-wrap: wrap;
    padding: 12px 0 12px 0;
  `,
    button: css `
    margin-left: 5px;
    margin-right: 5px;
  `,
});
//# sourceMappingURL=QuickPositioning.js.map