import { __assign, __extends } from "tslib";
import React from 'react';
import { LegendDisplayMode } from '@grafana/schema';
import { PanelContextRoot, GraphNG, VizLayout, VizLegend, } from '@grafana/ui';
import { FieldType } from '@grafana/data';
import { preparePlotConfigBuilder } from './utils';
var propsToDiff = ['rowHeight', 'colWidth', 'showValue', 'mergeValues', 'alignValue'];
var TimelineChart = /** @class */ (function (_super) {
    __extends(TimelineChart, _super);
    function TimelineChart() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.panelContext = {};
        _this.prepConfig = function (alignedFrame, allFrames, getTimeRange) {
            _this.panelContext = _this.context;
            var eventBus = _this.panelContext.eventBus;
            return preparePlotConfigBuilder(__assign(__assign({ frame: alignedFrame, getTimeRange: getTimeRange, eventBus: eventBus, allFrames: _this.props.frames }, _this.props), { 
                // When there is only one row, use the full space
                rowHeight: alignedFrame.fields.length > 2 ? _this.props.rowHeight : 1 }));
        };
        _this.renderLegend = function (config) {
            var _a = _this.props, legend = _a.legend, legendItems = _a.legendItems;
            if (!config || !legendItems || !legend || legend.displayMode === LegendDisplayMode.Hidden) {
                return null;
            }
            return (React.createElement(VizLayout.Legend, { placement: legend.placement },
                React.createElement(VizLegend, { placement: legend.placement, items: legendItems, displayMode: legend.displayMode, readonly: true })));
        };
        return _this;
    }
    TimelineChart.prototype.render = function () {
        return (React.createElement(GraphNG, __assign({}, this.props, { fields: {
                x: function (f) { return f.type === FieldType.time; },
                y: function (f) { return f.type === FieldType.number || f.type === FieldType.boolean || f.type === FieldType.string; },
            }, prepConfig: this.prepConfig, propsToDiff: propsToDiff, renderLegend: this.renderLegend })));
    };
    TimelineChart.contextType = PanelContextRoot;
    return TimelineChart;
}(React.Component));
export { TimelineChart };
//# sourceMappingURL=TimelineChart.js.map