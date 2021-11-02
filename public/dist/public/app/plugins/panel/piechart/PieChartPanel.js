import { __read } from "tslib";
import React, { useEffect, useState } from 'react';
import { LegendDisplayMode } from '@grafana/schema';
import { DataHoverClearEvent, DataHoverEvent, FALLBACK_COLOR, formattedValueToString, getFieldDisplayValues, } from '@grafana/data';
import { PieChart } from './PieChart';
import { PieChartLegendValues } from './types';
import { Subscription } from 'rxjs';
import { SeriesVisibilityChangeBehavior, usePanelContext, useTheme2, VizLayout, VizLegend, } from '@grafana/ui';
import { filterDisplayItems, sumDisplayItemsReducer } from './utils';
var defaultLegendOptions = {
    displayMode: LegendDisplayMode.List,
    placement: 'right',
    calcs: [],
    values: [PieChartLegendValues.Percent],
};
/**
 * @beta
 */
export function PieChartPanel(props) {
    var data = props.data, timeZone = props.timeZone, fieldConfig = props.fieldConfig, replaceVariables = props.replaceVariables, width = props.width, height = props.height, options = props.options;
    var theme = useTheme2();
    var highlightedTitle = useSliceHighlightState();
    var fieldDisplayValues = getFieldDisplayValues({
        fieldConfig: fieldConfig,
        reduceOptions: options.reduceOptions,
        data: data.series,
        theme: theme,
        replaceVariables: replaceVariables,
        timeZone: timeZone,
    });
    if (!hasFrames(fieldDisplayValues)) {
        return (React.createElement("div", { className: "panel-empty" },
            React.createElement("p", null, "No data")));
    }
    return (React.createElement(VizLayout, { width: width, height: height, legend: getLegend(props, fieldDisplayValues) }, function (vizWidth, vizHeight) {
        return (React.createElement(PieChart, { width: vizWidth, height: vizHeight, highlightedTitle: highlightedTitle, fieldDisplayValues: fieldDisplayValues, tooltipOptions: options.tooltip, pieType: options.pieType, displayLabels: options.displayLabels }));
    }));
}
function getLegend(props, displayValues) {
    var _a;
    var legendOptions = (_a = props.options.legend) !== null && _a !== void 0 ? _a : defaultLegendOptions;
    if (legendOptions.displayMode === LegendDisplayMode.Hidden) {
        return undefined;
    }
    var total = displayValues.filter(filterDisplayItems).reduce(sumDisplayItemsReducer, 0);
    var legendItems = displayValues
        // Since the pie chart is always sorted, let's sort the legend as well.
        .sort(function (a, b) {
        if (isNaN(a.display.numeric)) {
            return 1;
        }
        else if (isNaN(b.display.numeric)) {
            return -1;
        }
        else {
            return b.display.numeric - a.display.numeric;
        }
    })
        .map(function (value, idx) {
        var _a, _b;
        var hidden = value.field.custom.hideFrom.viz;
        var display = value.display;
        return {
            label: (_a = display.title) !== null && _a !== void 0 ? _a : '',
            color: (_b = display.color) !== null && _b !== void 0 ? _b : FALLBACK_COLOR,
            yAxis: 1,
            disabled: hidden,
            getItemKey: function () { var _a; return ((_a = display.title) !== null && _a !== void 0 ? _a : '') + idx; },
            getDisplayValues: function () {
                var _a, _b;
                var valuesToShow = (_a = legendOptions.values) !== null && _a !== void 0 ? _a : [];
                var displayValues = [];
                if (valuesToShow.includes(PieChartLegendValues.Value)) {
                    displayValues.push({ numeric: display.numeric, text: formattedValueToString(display), title: 'Value' });
                }
                if (valuesToShow.includes(PieChartLegendValues.Percent)) {
                    var fractionOfTotal = hidden ? 0 : display.numeric / total;
                    var percentOfTotal = fractionOfTotal * 100;
                    displayValues.push({
                        numeric: fractionOfTotal,
                        percent: percentOfTotal,
                        text: hidden || isNaN(fractionOfTotal)
                            ? (_b = props.fieldConfig.defaults.noValue) !== null && _b !== void 0 ? _b : '-'
                            : percentOfTotal.toFixed(0) + '%',
                        title: valuesToShow.length > 1 ? 'Percent' : '',
                    });
                }
                return displayValues;
            },
        };
    });
    return (React.createElement(VizLegend, { items: legendItems, seriesVisibilityChangeBehavior: SeriesVisibilityChangeBehavior.Hide, placement: legendOptions.placement, displayMode: legendOptions.displayMode }));
}
function hasFrames(fieldDisplayValues) {
    return fieldDisplayValues.some(function (fd) { var _a; return (_a = fd.view) === null || _a === void 0 ? void 0 : _a.dataFrame.length; });
}
function useSliceHighlightState() {
    var _a = __read(useState(), 2), highlightedTitle = _a[0], setHighlightedTitle = _a[1];
    var eventBus = usePanelContext().eventBus;
    useEffect(function () {
        var setHighlightedSlice = function (event) {
            setHighlightedTitle(event.payload.dataId);
        };
        var resetHighlightedSlice = function (event) {
            setHighlightedTitle(undefined);
        };
        var subs = new Subscription();
        subs.add(eventBus.getStream(DataHoverEvent).subscribe({ next: setHighlightedSlice }));
        subs.add(eventBus.getStream(DataHoverClearEvent).subscribe({ next: resetHighlightedSlice }));
        return function () {
            subs.unsubscribe();
        };
    }, [setHighlightedTitle, eventBus]);
    return highlightedTitle;
}
//# sourceMappingURL=PieChartPanel.js.map