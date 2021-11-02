import { __assign } from "tslib";
import React, { useRef } from 'react';
import { cloneDeep } from 'lodash';
import { FieldType } from '@grafana/data';
import { GraphNG, PlotLegend, usePanelContext, useTheme2 } from '@grafana/ui';
import { LegendDisplayMode } from '@grafana/schema';
import { isLegendOrdered, preparePlotConfigBuilder, preparePlotFrame } from './utils';
var propsToDiff = [
    'orientation',
    'barWidth',
    'groupWidth',
    'stacking',
    'showValue',
    'legend',
    function (prev, next) { var _a, _b; return ((_a = next.text) === null || _a === void 0 ? void 0 : _a.valueSize) === ((_b = prev.text) === null || _b === void 0 ? void 0 : _b.valueSize); },
];
export var BarChart = function (props) {
    var theme = useTheme2();
    var eventBus = usePanelContext().eventBus;
    var frame0Ref = useRef();
    frame0Ref.current = props.frames[0];
    var renderLegend = function (config) {
        if (!config || props.legend.displayMode === LegendDisplayMode.Hidden) {
            return null;
        }
        return React.createElement(PlotLegend, __assign({ data: props.frames, config: config, maxHeight: "35%", maxWidth: "60%" }, props.legend));
    };
    var rawValue = function (seriesIdx, valueIdx) {
        // When sorted by legend state.seriesIndex is not changed and is not equal to the sorted index of the field
        if (isLegendOrdered(props.legend)) {
            return frame0Ref.current.fields[seriesIdx].values.get(valueIdx);
        }
        var field = frame0Ref.current.fields.find(function (f) { var _a; return f.type === FieldType.number && ((_a = f.state) === null || _a === void 0 ? void 0 : _a.seriesIndex) === seriesIdx - 1; });
        return field.values.get(valueIdx);
    };
    var prepConfig = function (alignedFrame, allFrames, getTimeRange) {
        var timeZone = props.timeZone, orientation = props.orientation, barWidth = props.barWidth, showValue = props.showValue, groupWidth = props.groupWidth, stacking = props.stacking, legend = props.legend, tooltip = props.tooltip, text = props.text;
        return preparePlotConfigBuilder({
            frame: alignedFrame,
            getTimeRange: getTimeRange,
            theme: theme,
            timeZone: timeZone,
            eventBus: eventBus,
            orientation: orientation,
            barWidth: barWidth,
            showValue: showValue,
            groupWidth: groupWidth,
            stacking: stacking,
            legend: legend,
            tooltip: tooltip,
            text: text,
            rawValue: rawValue,
            allFrames: props.frames,
        });
    };
    return (React.createElement(GraphNG
    // My heart is bleeding with the clone deep here, but nested options...
    , __assign({}, cloneDeep(props), { theme: theme, frames: props.frames, prepConfig: prepConfig, propsToDiff: propsToDiff, preparePlotFrame: preparePlotFrame, renderLegend: renderLegend })));
};
BarChart.displayName = 'BarChart';
//# sourceMappingURL=BarChart.js.map