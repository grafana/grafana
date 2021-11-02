import { __makeTemplateObject, __read } from "tslib";
import React, { useMemo, useState } from 'react';
import { css } from '@emotion/css';
import { useStyles2, useTheme2 } from '@grafana/ui';
import Draggable from 'react-draggable';
export var ThresholdDragHandle = function (_a) {
    var step = _a.step, y = _a.y, dragBounds = _a.dragBounds, mapPositionToValue = _a.mapPositionToValue, formatValue = _a.formatValue, onChange = _a.onChange;
    var theme = useTheme2();
    var styles = useStyles2(getStyles);
    var _b = __read(useState(step.value), 2), currentValue = _b[0], setCurrentValue = _b[1];
    var textColor = useMemo(function () {
        return theme.colors.getContrastText(theme.visualization.getColorByName(step.color));
    }, [step.color, theme]);
    return (React.createElement(Draggable, { axis: "y", grid: [1, 1], onStop: function (_e, d) {
            onChange(mapPositionToValue(d.lastY));
            // as of https://github.com/react-grid-layout/react-draggable/issues/390#issuecomment-623237835
            return false;
        }, onDrag: function (_e, d) { return setCurrentValue(mapPositionToValue(d.lastY)); }, position: { x: 0, y: y }, bounds: dragBounds },
        React.createElement("div", { className: styles.handle, style: { color: textColor, background: step.color, borderColor: step.color, borderWidth: 0 } },
            React.createElement("span", { className: styles.handleText }, formatValue(currentValue)))));
};
ThresholdDragHandle.displayName = 'ThresholdDragHandle';
var getStyles = function (theme) {
    return {
        handle: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      position: absolute;\n      left: 0;\n      width: calc(100% - 9px);\n      height: 18px;\n      margin-left: 9px;\n      margin-top: -9px;\n      cursor: grab;\n      font-size: ", ";\n      &:before {\n        content: '';\n        position: absolute;\n        left: -9px;\n        bottom: 0;\n        width: 0;\n        height: 0;\n        border-right-style: solid;\n        border-right-width: 9px;\n        border-right-color: inherit;\n        border-top: 9px solid transparent;\n        border-bottom: 9px solid transparent;\n      }\n    "], ["\n      position: absolute;\n      left: 0;\n      width: calc(100% - 9px);\n      height: 18px;\n      margin-left: 9px;\n      margin-top: -9px;\n      cursor: grab;\n      font-size: ", ";\n      &:before {\n        content: '';\n        position: absolute;\n        left: -9px;\n        bottom: 0;\n        width: 0;\n        height: 0;\n        border-right-style: solid;\n        border-right-width: 9px;\n        border-right-color: inherit;\n        border-top: 9px solid transparent;\n        border-bottom: 9px solid transparent;\n      }\n    "])), theme.typography.bodySmall.fontSize),
        handleText: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      display: block;\n      text-overflow: ellipsis;\n      white-space: nowrap;\n      overflow: hidden;\n    "], ["\n      display: block;\n      text-overflow: ellipsis;\n      white-space: nowrap;\n      overflow: hidden;\n    "]))),
    };
};
var templateObject_1, templateObject_2;
//# sourceMappingURL=ThresholdDragHandle.js.map