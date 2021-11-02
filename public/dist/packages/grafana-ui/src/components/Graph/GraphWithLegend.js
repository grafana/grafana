// Libraries
import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { Graph } from './Graph';
import { LegendDisplayMode } from '@grafana/schema';
import { VizLegend } from '../VizLegend/VizLegend';
import { CustomScrollbar } from '../CustomScrollbar/CustomScrollbar';
import { stylesFactory } from '../../themes';
var getGraphWithLegendStyles = stylesFactory(function (_a) {
    var placement = _a.placement;
    return ({
        wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    display: flex;\n    flex-direction: ", ";\n  "], ["\n    display: flex;\n    flex-direction: ", ";\n  "])), placement === 'bottom' ? 'column' : 'row'),
        graphContainer: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    min-height: 65%;\n    flex-grow: 1;\n  "], ["\n    min-height: 65%;\n    flex-grow: 1;\n  "]))),
        legendContainer: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    padding: 10px 0;\n    max-height: ", ";\n  "], ["\n    padding: 10px 0;\n    max-height: ", ";\n  "])), placement === 'bottom' ? '35%' : 'none'),
    });
});
var shouldHideLegendItem = function (data, hideEmpty, hideZero) {
    if (hideEmpty === void 0) { hideEmpty = false; }
    if (hideZero === void 0) { hideZero = false; }
    var isZeroOnlySeries = data.reduce(function (acc, current) { return acc + (current[1] || 0); }, 0) === 0;
    var isNullOnlySeries = !data.reduce(function (acc, current) { return acc && current[1] !== null; }, true);
    return (hideEmpty && isNullOnlySeries) || (hideZero && isZeroOnlySeries);
};
export var GraphWithLegend = function (props) {
    var series = props.series, timeRange = props.timeRange, width = props.width, height = props.height, showBars = props.showBars, showLines = props.showLines, showPoints = props.showPoints, sortLegendBy = props.sortLegendBy, sortLegendDesc = props.sortLegendDesc, legendDisplayMode = props.legendDisplayMode, placement = props.placement, onSeriesToggle = props.onSeriesToggle, onToggleSort = props.onToggleSort, hideEmpty = props.hideEmpty, hideZero = props.hideZero, isStacked = props.isStacked, lineWidth = props.lineWidth, onHorizontalRegionSelected = props.onHorizontalRegionSelected, timeZone = props.timeZone, children = props.children, ariaLabel = props.ariaLabel;
    var _a = getGraphWithLegendStyles(props), graphContainer = _a.graphContainer, wrapper = _a.wrapper, legendContainer = _a.legendContainer;
    var legendItems = series.reduce(function (acc, s) {
        return shouldHideLegendItem(s.data, hideEmpty, hideZero)
            ? acc
            : acc.concat([
                {
                    label: s.label,
                    color: s.color || '',
                    disabled: !s.isVisible,
                    yAxis: s.yAxis.index,
                    getDisplayValues: function () { return s.info || []; },
                },
            ]);
    }, []);
    return (React.createElement("div", { className: wrapper, "aria-label": ariaLabel },
        React.createElement("div", { className: graphContainer },
            React.createElement(Graph, { series: series, timeRange: timeRange, timeZone: timeZone, showLines: showLines, showPoints: showPoints, showBars: showBars, width: width, height: height, isStacked: isStacked, lineWidth: lineWidth, onHorizontalRegionSelected: onHorizontalRegionSelected }, children)),
        legendDisplayMode !== LegendDisplayMode.Hidden && (React.createElement("div", { className: legendContainer },
            React.createElement(CustomScrollbar, { hideHorizontalTrack: true },
                React.createElement(VizLegend, { items: legendItems, displayMode: legendDisplayMode, placement: placement, sortBy: sortLegendBy, sortDesc: sortLegendDesc, onLabelClick: function (item, event) {
                        if (onSeriesToggle) {
                            onSeriesToggle(item.label, event);
                        }
                    }, onToggleSort: onToggleSort }))))));
};
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=GraphWithLegend.js.map