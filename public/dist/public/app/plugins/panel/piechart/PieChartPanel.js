import React, { useEffect, useState } from 'react';
import { Subscription } from 'rxjs';
import { DataHoverClearEvent, DataHoverEvent, FALLBACK_COLOR, formattedValueToString, getFieldDisplayValues, } from '@grafana/data';
import { PanelDataErrorView } from '@grafana/runtime';
import { LegendDisplayMode } from '@grafana/schema';
import { SeriesVisibilityChangeBehavior, usePanelContext, useTheme2, VizLayout, VizLegend, } from '@grafana/ui';
import { PieChart } from './PieChart';
import { PieChartLegendValues } from './panelcfg.gen';
import { filterDisplayItems, sumDisplayItemsReducer } from './utils';
const defaultLegendOptions = {
    displayMode: LegendDisplayMode.List,
    showLegend: true,
    placement: 'right',
    calcs: [],
    values: [PieChartLegendValues.Percent],
};
/**
 * @beta
 */
export function PieChartPanel(props) {
    const { data, timeZone, fieldConfig, replaceVariables, width, height, options, id } = props;
    const theme = useTheme2();
    const highlightedTitle = useSliceHighlightState();
    const fieldDisplayValues = getFieldDisplayValues({
        fieldConfig,
        reduceOptions: options.reduceOptions,
        data: data.series,
        theme: theme,
        replaceVariables,
        timeZone,
    });
    if (!hasFrames(fieldDisplayValues)) {
        return React.createElement(PanelDataErrorView, { panelId: id, fieldConfig: fieldConfig, data: data });
    }
    return (React.createElement(VizLayout, { width: width, height: height, legend: getLegend(props, fieldDisplayValues) }, (vizWidth, vizHeight) => {
        return (React.createElement(PieChart, { width: vizWidth, height: vizHeight, highlightedTitle: highlightedTitle, fieldDisplayValues: fieldDisplayValues, tooltipOptions: options.tooltip, pieType: options.pieType, displayLabels: options.displayLabels }));
    }));
}
function getLegend(props, displayValues) {
    var _a;
    const legendOptions = (_a = props.options.legend) !== null && _a !== void 0 ? _a : defaultLegendOptions;
    if (legendOptions.showLegend === false) {
        return undefined;
    }
    const total = displayValues.filter(filterDisplayItems).reduce(sumDisplayItemsReducer, 0);
    const legendItems = displayValues
        // Since the pie chart is always sorted, let's sort the legend as well.
        .sort((a, b) => {
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
        .map((value, idx) => {
        var _a, _b, _c, _d;
        const hideFrom = (_b = (_a = value.field.custom) === null || _a === void 0 ? void 0 : _a.hideFrom) !== null && _b !== void 0 ? _b : {};
        if (hideFrom.legend) {
            return undefined;
        }
        const hideFromViz = Boolean(hideFrom.viz);
        const display = value.display;
        return {
            label: (_c = display.title) !== null && _c !== void 0 ? _c : '',
            color: (_d = display.color) !== null && _d !== void 0 ? _d : FALLBACK_COLOR,
            yAxis: 1,
            disabled: hideFromViz,
            getItemKey: () => { var _a; return ((_a = display.title) !== null && _a !== void 0 ? _a : '') + idx; },
            getDisplayValues: () => {
                var _a, _b, _c;
                const valuesToShow = (_a = legendOptions.values) !== null && _a !== void 0 ? _a : [];
                let displayValues = [];
                if (valuesToShow.includes(PieChartLegendValues.Value)) {
                    displayValues.push({ numeric: display.numeric, text: formattedValueToString(display), title: 'Value' });
                }
                if (valuesToShow.includes(PieChartLegendValues.Percent)) {
                    const fractionOfTotal = hideFromViz ? 0 : display.numeric / total;
                    const percentOfTotal = fractionOfTotal * 100;
                    displayValues.push({
                        numeric: fractionOfTotal,
                        percent: percentOfTotal,
                        text: hideFromViz || isNaN(fractionOfTotal)
                            ? (_b = props.fieldConfig.defaults.noValue) !== null && _b !== void 0 ? _b : '-'
                            : percentOfTotal.toFixed((_c = value.field.decimals) !== null && _c !== void 0 ? _c : 0) + '%',
                        title: valuesToShow.length > 1 ? 'Percent' : '',
                    });
                }
                return displayValues;
            },
        };
    })
        .filter((i) => !!i);
    return (React.createElement(VizLayout.Legend, { placement: legendOptions.placement, width: legendOptions.width },
        React.createElement(VizLegend, { items: legendItems, seriesVisibilityChangeBehavior: SeriesVisibilityChangeBehavior.Hide, placement: legendOptions.placement, displayMode: legendOptions.displayMode })));
}
function hasFrames(fieldDisplayValues) {
    return fieldDisplayValues.some((fd) => { var _a; return (_a = fd.view) === null || _a === void 0 ? void 0 : _a.dataFrame.length; });
}
function useSliceHighlightState() {
    const [highlightedTitle, setHighlightedTitle] = useState();
    const { eventBus } = usePanelContext();
    useEffect(() => {
        const setHighlightedSlice = (event) => {
            setHighlightedTitle(event.payload.dataId);
        };
        const resetHighlightedSlice = (event) => {
            setHighlightedTitle(undefined);
        };
        const subs = new Subscription();
        subs.add(eventBus.getStream(DataHoverEvent).subscribe({ next: setHighlightedSlice }));
        subs.add(eventBus.getStream(DataHoverClearEvent).subscribe({ next: resetHighlightedSlice }));
        return () => {
            subs.unsubscribe();
        };
    }, [setHighlightedTitle, eventBus]);
    return highlightedTitle;
}
//# sourceMappingURL=PieChartPanel.js.map