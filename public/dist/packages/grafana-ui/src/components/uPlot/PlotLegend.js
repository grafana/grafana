import { __assign, __rest } from "tslib";
import React from 'react';
import { fieldReducers, getFieldDisplayName, getFieldSeriesColor, reduceField, } from '@grafana/data';
import { AxisPlacement } from '@grafana/schema';
import { VizLayout } from '../VizLayout/VizLayout';
import { VizLegend } from '../VizLegend/VizLegend';
import { useTheme2 } from '../../themes';
var defaultFormatter = function (v) { return (v == null ? '-' : v.toFixed(1)); };
export var PlotLegend = function (_a) {
    var data = _a.data, config = _a.config, placement = _a.placement, calcs = _a.calcs, displayMode = _a.displayMode, vizLayoutLegendProps = __rest(_a, ["data", "config", "placement", "calcs", "displayMode"]);
    var theme = useTheme2();
    var legendItems = config
        .getSeries()
        .map(function (s) {
        var _a, _b, _c, _d;
        var seriesConfig = s.props;
        var fieldIndex = seriesConfig.dataFrameFieldIndex;
        var axisPlacement = config.getAxisPlacement(s.props.scaleKey);
        if (!fieldIndex) {
            return undefined;
        }
        var field = (_a = data[fieldIndex.frameIndex]) === null || _a === void 0 ? void 0 : _a.fields[fieldIndex.fieldIndex];
        if (!field || ((_c = (_b = field.config.custom) === null || _b === void 0 ? void 0 : _b.hideFrom) === null || _c === void 0 ? void 0 : _c.legend)) {
            return undefined;
        }
        var label = getFieldDisplayName(field, data[fieldIndex.frameIndex], data);
        var scaleColor = getFieldSeriesColor(field, theme);
        var seriesColor = scaleColor.color;
        return {
            disabled: !((_d = seriesConfig.show) !== null && _d !== void 0 ? _d : true),
            fieldIndex: fieldIndex,
            color: seriesColor,
            label: label,
            yAxis: axisPlacement === AxisPlacement.Left ? 1 : 2,
            getDisplayValues: function () {
                var _a;
                if (!(calcs === null || calcs === void 0 ? void 0 : calcs.length)) {
                    return [];
                }
                var fmt = (_a = field.display) !== null && _a !== void 0 ? _a : defaultFormatter;
                var fieldCalcs = reduceField({
                    field: field,
                    reducers: calcs,
                });
                return calcs.map(function (reducerId) {
                    var fieldReducer = fieldReducers.get(reducerId);
                    return __assign(__assign({}, fmt(fieldCalcs[reducerId])), { title: fieldReducer.name, description: fieldReducer.description });
                });
            },
            getItemKey: function () { return label + "-" + fieldIndex.frameIndex + "-" + fieldIndex.fieldIndex; },
        };
    })
        .filter(function (i) { return i !== undefined; });
    return (React.createElement(VizLayout.Legend, __assign({ placement: placement }, vizLayoutLegendProps),
        React.createElement(VizLegend, { placement: placement, items: legendItems, displayMode: displayMode, sortBy: vizLayoutLegendProps.sortBy, sortDesc: vizLayoutLegendProps.sortDesc })));
};
PlotLegend.displayName = 'PlotLegend';
//# sourceMappingURL=PlotLegend.js.map