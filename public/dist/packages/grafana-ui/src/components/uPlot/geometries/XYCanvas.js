import { __makeTemplateObject } from "tslib";
import React, { useMemo } from 'react';
import { css } from '@emotion/css';
/**
 * Renders absolutely positioned element on top of the uPlot's plotting area (axes are not included!).
 * Useful when you want to render some overlay with canvas-independent elements on top of the plot.
 */
export var XYCanvas = function (_a) {
    var children = _a.children, left = _a.left, top = _a.top;
    var className = useMemo(function () {
        return css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      position: absolute;\n      overflow: visible;\n      left: ", "px;\n      top: ", "px;\n    "], ["\n      position: absolute;\n      overflow: visible;\n      left: ", "px;\n      top: ", "px;\n    "])), left, top);
    }, [left, top]);
    return React.createElement("div", { className: className }, children);
};
var templateObject_1;
//# sourceMappingURL=XYCanvas.js.map