import { __makeTemplateObject, __read } from "tslib";
import { css, cx } from '@emotion/css';
import { applyFieldOverrides, compareArrayValues, compareDataFrameStructures, createFieldConfigRegistry, dateTime, FieldColorModeId, getFrameDisplayName, } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import { GraphDrawStyle, LegendDisplayMode, TooltipDisplayMode } from '@grafana/schema';
import { Icon, PanelContextProvider, useStyles2, useTheme2, } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { defaultGraphConfig, getGraphFieldConfig } from 'app/plugins/panel/timeseries/config';
import { identity } from 'lodash';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePrevious } from 'react-use';
import { seriesVisibilityConfigFactory } from '../dashboard/dashgrid/SeriesVisibilityConfigFactory';
import { applyGraphStyle } from './exploreGraphStyleUtils';
var MAX_NUMBER_OF_TIME_SERIES = 20;
export function ExploreGraph(_a) {
    var data = _a.data, height = _a.height, width = _a.width, timeZone = _a.timeZone, absoluteRange = _a.absoluteRange, onChangeTime = _a.onChangeTime, loadingState = _a.loadingState, annotations = _a.annotations, onHiddenSeriesChanged = _a.onHiddenSeriesChanged, splitOpenFn = _a.splitOpenFn, graphStyle = _a.graphStyle, _b = _a.tooltipDisplayMode, tooltipDisplayMode = _b === void 0 ? TooltipDisplayMode.Single : _b;
    var theme = useTheme2();
    var _c = __read(useState(false), 2), showAllTimeSeries = _c[0], setShowAllTimeSeries = _c[1];
    var _d = __read(useState(1), 2), baseStructureRev = _d[0], setBaseStructureRev = _d[1];
    var previousData = usePrevious(data);
    var structureChangesRef = useRef(0);
    if (data && previousData && !compareArrayValues(previousData, data, compareDataFrameStructures)) {
        structureChangesRef.current++;
    }
    var structureRev = baseStructureRev + structureChangesRef.current;
    var _e = __read(useState({
        defaults: {
            color: {
                mode: FieldColorModeId.PaletteClassic,
            },
            custom: {
                drawStyle: GraphDrawStyle.Line,
                fillOpacity: 0,
                pointSize: 5,
            },
        },
        overrides: [],
    }), 2), fieldConfig = _e[0], setFieldConfig = _e[1];
    var style = useStyles2(getStyles);
    var timeRange = {
        from: dateTime(absoluteRange.from),
        to: dateTime(absoluteRange.to),
        raw: {
            from: dateTime(absoluteRange.from),
            to: dateTime(absoluteRange.to),
        },
    };
    var dataWithConfig = useMemo(function () {
        var registry = createFieldConfigRegistry(getGraphFieldConfig(defaultGraphConfig), 'Explore');
        var styledFieldConfig = applyGraphStyle(fieldConfig, graphStyle);
        return applyFieldOverrides({
            fieldConfig: styledFieldConfig,
            data: data,
            timeZone: timeZone,
            replaceVariables: function (value) { return value; },
            theme: theme,
            fieldConfigRegistry: registry,
        });
    }, [fieldConfig, graphStyle, data, timeZone, theme]);
    useEffect(function () {
        if (onHiddenSeriesChanged) {
            var hiddenFrames_1 = [];
            dataWithConfig.forEach(function (frame) {
                var allFieldsHidden = frame.fields.map(function (field) { var _a, _b, _c; return (_c = (_b = (_a = field.config) === null || _a === void 0 ? void 0 : _a.custom) === null || _b === void 0 ? void 0 : _b.hideFrom) === null || _c === void 0 ? void 0 : _c.viz; }).every(identity);
                if (allFieldsHidden) {
                    hiddenFrames_1.push(getFrameDisplayName(frame));
                }
            });
            onHiddenSeriesChanged(hiddenFrames_1);
        }
    }, [dataWithConfig, onHiddenSeriesChanged]);
    var seriesToShow = showAllTimeSeries ? dataWithConfig : dataWithConfig.slice(0, MAX_NUMBER_OF_TIME_SERIES);
    var panelContext = {
        eventBus: appEvents,
        onSplitOpen: splitOpenFn,
        onToggleSeriesVisibility: function (label, mode) {
            setBaseStructureRev(function (r) { return r + 1; });
            setFieldConfig(seriesVisibilityConfigFactory(label, mode, fieldConfig, data));
        },
    };
    return (React.createElement(PanelContextProvider, { value: panelContext },
        dataWithConfig.length > MAX_NUMBER_OF_TIME_SERIES && !showAllTimeSeries && (React.createElement("div", { className: cx([style.timeSeriesDisclaimer]) },
            React.createElement(Icon, { className: style.disclaimerIcon, name: "exclamation-triangle" }), "Showing only " + MAX_NUMBER_OF_TIME_SERIES + " time series. ",
            React.createElement("span", { className: cx([style.showAllTimeSeries]), onClick: function () {
                    structureChangesRef.current++;
                    setShowAllTimeSeries(true);
                } }, "Show all " + dataWithConfig.length))),
        React.createElement(PanelRenderer, { data: { series: seriesToShow, timeRange: timeRange, structureRev: structureRev, state: loadingState, annotations: annotations }, pluginId: "timeseries", title: "", width: width, height: height, onChangeTimeRange: onChangeTime, options: {
                tooltip: { mode: tooltipDisplayMode },
                legend: { displayMode: LegendDisplayMode.List, placement: 'bottom', calcs: [] },
            } })));
}
var getStyles = function (theme) { return ({
    timeSeriesDisclaimer: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    label: time-series-disclaimer;\n    width: 300px;\n    margin: ", " auto;\n    padding: 10px 0;\n    border-radius: ", ";\n    text-align: center;\n    background-color: ", ";\n  "], ["\n    label: time-series-disclaimer;\n    width: 300px;\n    margin: ", " auto;\n    padding: 10px 0;\n    border-radius: ", ";\n    text-align: center;\n    background-color: ", ";\n  "])), theme.spacing(1), theme.spacing(2), theme.colors.background.primary),
    disclaimerIcon: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    label: disclaimer-icon;\n    color: ", ";\n    margin-right: ", ";\n  "], ["\n    label: disclaimer-icon;\n    color: ", ";\n    margin-right: ", ";\n  "])), theme.colors.warning.main, theme.spacing(0.5)),
    showAllTimeSeries: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    label: show-all-time-series;\n    cursor: pointer;\n    color: ", ";\n  "], ["\n    label: show-all-time-series;\n    cursor: pointer;\n    color: ", ";\n  "])), theme.colors.text.link),
}); };
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=ExploreGraph.js.map