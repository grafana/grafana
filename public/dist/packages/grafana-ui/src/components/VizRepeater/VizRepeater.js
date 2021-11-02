import { __assign, __extends } from "tslib";
import React, { PureComponent } from 'react';
import { VizOrientation } from '@grafana/data';
import { calculateGridDimensions } from '../../utils/squares';
var VizRepeater = /** @class */ (function (_super) {
    __extends(VizRepeater, _super);
    function VizRepeater(props) {
        var _this = _super.call(this, props) || this;
        _this.state = {
            values: props.getValues(),
        };
        return _this;
    }
    VizRepeater.prototype.componentDidUpdate = function (prevProps) {
        var _a = this.props, renderCounter = _a.renderCounter, source = _a.source;
        if (renderCounter !== prevProps.renderCounter || source !== prevProps.source) {
            this.setState({ values: this.props.getValues() });
        }
    };
    VizRepeater.prototype.getOrientation = function () {
        var _a = this.props, orientation = _a.orientation, width = _a.width, height = _a.height;
        if (orientation === VizOrientation.Auto) {
            if (width > height) {
                return VizOrientation.Vertical;
            }
            else {
                return VizOrientation.Horizontal;
            }
        }
        return orientation;
    };
    VizRepeater.prototype.renderGrid = function () {
        var _a = this
            .props, renderValue = _a.renderValue, height = _a.height, width = _a.width, itemSpacing = _a.itemSpacing, getAlignmentFactors = _a.getAlignmentFactors, orientation = _a.orientation;
        var values = this.state.values;
        var grid = calculateGridDimensions(width, height, itemSpacing, values.length);
        var alignmentFactors = getAlignmentFactors ? getAlignmentFactors(values, grid.width, grid.height) : {};
        var xGrid = 0;
        var yGrid = 0;
        var items = [];
        for (var i = 0; i < values.length; i++) {
            var value = values[i];
            var isLastRow = yGrid === grid.yCount - 1;
            var itemWidth = isLastRow ? grid.widthOnLastRow : grid.width;
            var itemHeight = grid.height;
            var xPos = xGrid * itemWidth + itemSpacing * xGrid;
            var yPos = yGrid * itemHeight + itemSpacing * yGrid;
            var itemStyles = {
                position: 'absolute',
                left: xPos,
                top: yPos,
                width: itemWidth + "px",
                height: itemHeight + "px",
            };
            items.push(React.createElement("div", { key: i, style: itemStyles }, renderValue({
                value: value,
                width: itemWidth,
                height: itemHeight,
                alignmentFactors: alignmentFactors,
                orientation: orientation,
                count: values.length,
            })));
            xGrid++;
            if (xGrid === grid.xCount) {
                xGrid = 0;
                yGrid++;
            }
        }
        return React.createElement("div", { style: { position: 'relative' } }, items);
    };
    VizRepeater.prototype.render = function () {
        var _a = this
            .props, renderValue = _a.renderValue, height = _a.height, width = _a.width, itemSpacing = _a.itemSpacing, getAlignmentFactors = _a.getAlignmentFactors, autoGrid = _a.autoGrid, orientation = _a.orientation, minVizHeight = _a.minVizHeight;
        var values = this.state.values;
        if (autoGrid && orientation === VizOrientation.Auto) {
            return this.renderGrid();
        }
        var itemStyles = {
            display: 'flex',
        };
        var repeaterStyle = {
            display: 'flex',
            overflow: minVizHeight ? 'hidden auto' : 'hidden',
        };
        var vizHeight = height;
        var vizWidth = width;
        var resolvedOrientation = this.getOrientation();
        switch (resolvedOrientation) {
            case VizOrientation.Horizontal:
                repeaterStyle.flexDirection = 'column';
                repeaterStyle.height = height + "px";
                itemStyles.marginBottom = itemSpacing + "px";
                vizWidth = width;
                vizHeight = Math.max(height / values.length - itemSpacing + itemSpacing / values.length, minVizHeight !== null && minVizHeight !== void 0 ? minVizHeight : 0);
                break;
            case VizOrientation.Vertical:
                repeaterStyle.flexDirection = 'row';
                repeaterStyle.justifyContent = 'space-between';
                itemStyles.marginRight = itemSpacing + "px";
                vizHeight = height;
                vizWidth = width / values.length - itemSpacing + itemSpacing / values.length;
        }
        itemStyles.width = vizWidth + "px";
        itemStyles.height = vizHeight + "px";
        var alignmentFactors = getAlignmentFactors ? getAlignmentFactors(values, vizWidth, vizHeight) : {};
        return (React.createElement("div", { style: repeaterStyle }, values.map(function (value, index) {
            return (React.createElement("div", { key: index, style: getItemStylesForIndex(itemStyles, index, values.length) }, renderValue({
                value: value,
                width: vizWidth,
                height: vizHeight,
                alignmentFactors: alignmentFactors,
                orientation: resolvedOrientation,
                count: values.length,
            })));
        })));
    };
    VizRepeater.defaultProps = {
        itemSpacing: 8,
    };
    return VizRepeater;
}(PureComponent));
export { VizRepeater };
/*
 * Removes any padding on the last item
 */
function getItemStylesForIndex(itemStyles, index, length) {
    if (index === length - 1) {
        return __assign(__assign({}, itemStyles), { marginRight: 0, marginBottom: 0 });
    }
    return itemStyles;
}
//# sourceMappingURL=VizRepeater.js.map