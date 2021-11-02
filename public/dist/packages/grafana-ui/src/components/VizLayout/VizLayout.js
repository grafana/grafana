import { __read } from "tslib";
import React from 'react';
import { useMeasure } from 'react-use';
import { CustomScrollbar } from '../CustomScrollbar/CustomScrollbar';
/**
 * @beta
 */
export var VizLayout = function (_a) {
    var width = _a.width, height = _a.height, legend = _a.legend, children = _a.children;
    var containerStyle = {
        display: 'flex',
        width: width + "px",
        height: height + "px",
    };
    var _b = __read(useMeasure(), 2), legendRef = _b[0], legendMeasure = _b[1];
    if (!legend) {
        return React.createElement("div", { style: containerStyle }, children(width, height));
    }
    var _c = legend.props, placement = _c.placement, _d = _c.maxHeight, maxHeight = _d === void 0 ? '35%' : _d, _e = _c.maxWidth, maxWidth = _e === void 0 ? '60%' : _e;
    var size = null;
    var vizStyle = {
        flexGrow: 2,
    };
    var legendStyle = {};
    switch (placement) {
        case 'bottom':
            containerStyle.flexDirection = 'column';
            legendStyle.maxHeight = maxHeight;
            if (legendMeasure) {
                size = { width: width, height: height - legendMeasure.height };
            }
            break;
        case 'right':
            containerStyle.flexDirection = 'row';
            legendStyle.maxWidth = maxWidth;
            if (legendMeasure) {
                size = { width: width - legendMeasure.width, height: height };
            }
            break;
    }
    // This happens when position is switched from bottom to right
    // Then we preserve old with for one render cycle until legend is measured in it's new position
    if ((size === null || size === void 0 ? void 0 : size.width) === 0) {
        size.width = width;
    }
    if ((size === null || size === void 0 ? void 0 : size.height) === 0) {
        size.height = height;
    }
    return (React.createElement("div", { style: containerStyle },
        React.createElement("div", { style: vizStyle }, size && children(size.width, size.height)),
        React.createElement("div", { style: legendStyle, ref: legendRef },
            React.createElement(CustomScrollbar, { hideHorizontalTrack: true }, legend))));
};
/**
 * @beta
 */
export var VizLayoutLegend = function (_a) {
    var children = _a.children;
    return React.createElement(React.Fragment, null, children);
};
VizLayout.Legend = VizLayoutLegend;
//# sourceMappingURL=VizLayout.js.map