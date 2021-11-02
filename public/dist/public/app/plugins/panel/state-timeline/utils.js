import { __assign, __read, __spreadArray, __values } from "tslib";
import { ArrayVector, FALLBACK_COLOR, FieldColorModeId, FieldType, formattedValueToString, getFieldDisplayName, getValueFormat, getActiveThreshold, getFieldConfigWithMinMax, outerJoinDataFrames, ThresholdsMode, } from '@grafana/data';
import { FIXED_UNIT, SeriesVisibilityChangeMode, UPlotConfigBuilder, } from '@grafana/ui';
import { getConfig } from './timeline';
import { AxisPlacement, ScaleDirection, ScaleOrientation } from '@grafana/schema';
import { preparePlotData } from '../../../../../packages/grafana-ui/src/components/uPlot/utils';
var defaultConfig = {
    lineWidth: 0,
    fillOpacity: 80,
};
export function mapMouseEventToMode(event) {
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
        return SeriesVisibilityChangeMode.AppendToSelection;
    }
    return SeriesVisibilityChangeMode.ToggleSelection;
}
export function preparePlotFrame(data, dimFields) {
    return outerJoinDataFrames({
        frames: data,
        joinBy: dimFields.x,
        keep: dimFields.y,
        keepOriginIndices: true,
    });
}
export var preparePlotConfigBuilder = function (_a) {
    var _b, _c;
    var frame = _a.frame, theme = _a.theme, timeZone = _a.timeZone, getTimeRange = _a.getTimeRange, mode = _a.mode, rowHeight = _a.rowHeight, colWidth = _a.colWidth, showValue = _a.showValue, alignValue = _a.alignValue;
    var builder = new UPlotConfigBuilder(timeZone);
    var isDiscrete = function (field) {
        var _a, _b;
        var mode = (_b = (_a = field.config) === null || _a === void 0 ? void 0 : _a.color) === null || _b === void 0 ? void 0 : _b.mode;
        return !(mode && field.display && mode.startsWith('continuous-'));
    };
    var getValueColor = function (seriesIdx, value) {
        var field = frame.fields[seriesIdx];
        if (field.display) {
            var disp = field.display(value); // will apply color modes
            if (disp.color) {
                return disp.color;
            }
        }
        return FALLBACK_COLOR;
    };
    var opts = {
        // should expose in panel config
        mode: mode,
        numSeries: frame.fields.length - 1,
        isDiscrete: function (seriesIdx) { return isDiscrete(frame.fields[seriesIdx]); },
        rowHeight: rowHeight,
        colWidth: colWidth,
        showValue: showValue,
        alignValue: alignValue,
        theme: theme,
        label: function (seriesIdx) { return getFieldDisplayName(frame.fields[seriesIdx], frame); },
        getFieldConfig: function (seriesIdx) { return frame.fields[seriesIdx].config.custom; },
        getValueColor: getValueColor,
        getTimeRange: getTimeRange,
        // hardcoded formatter for state values
        formatValue: function (seriesIdx, value) { return formattedValueToString(frame.fields[seriesIdx].display(value)); },
        onHover: function (seriesIndex, valueIndex) {
            hoveredSeriesIdx = seriesIndex;
            hoveredDataIdx = valueIndex;
            shouldChangeHover = true;
        },
        onLeave: function () {
            hoveredSeriesIdx = null;
            hoveredDataIdx = null;
            shouldChangeHover = true;
        },
    };
    var shouldChangeHover = false;
    var hoveredSeriesIdx = null;
    var hoveredDataIdx = null;
    var coreConfig = getConfig(opts);
    builder.addHook('init', coreConfig.init);
    builder.addHook('drawClear', coreConfig.drawClear);
    builder.addHook('setCursor', coreConfig.setCursor);
    // in TooltipPlugin, this gets invoked and the result is bound to a setCursor hook
    // which fires after the above setCursor hook, so can take advantage of hoveringOver
    // already set by the above onHover/onLeave callbacks that fire from coreConfig.setCursor
    var interpolateTooltip = function (updateActiveSeriesIdx, updateActiveDatapointIdx, updateTooltipPosition) {
        if (shouldChangeHover) {
            if (hoveredSeriesIdx != null) {
                updateActiveSeriesIdx(hoveredSeriesIdx);
                updateActiveDatapointIdx(hoveredDataIdx);
            }
            shouldChangeHover = false;
        }
        updateTooltipPosition(hoveredSeriesIdx == null);
    };
    builder.setTooltipInterpolator(interpolateTooltip);
    builder.setPrepData(preparePlotData);
    builder.setCursor(coreConfig.cursor);
    builder.addScale({
        scaleKey: 'x',
        isTime: true,
        orientation: ScaleOrientation.Horizontal,
        direction: ScaleDirection.Right,
        range: coreConfig.xRange,
    });
    builder.addScale({
        scaleKey: FIXED_UNIT,
        isTime: false,
        orientation: ScaleOrientation.Vertical,
        direction: ScaleDirection.Up,
        range: coreConfig.yRange,
    });
    builder.addAxis({
        scaleKey: 'x',
        isTime: true,
        splits: coreConfig.xSplits,
        placement: AxisPlacement.Bottom,
        timeZone: timeZone,
        theme: theme,
        grid: { show: true },
    });
    builder.addAxis({
        scaleKey: FIXED_UNIT,
        isTime: false,
        placement: AxisPlacement.Left,
        splits: coreConfig.ySplits,
        values: coreConfig.yValues,
        grid: { show: false },
        ticks: false,
        gap: 16,
        theme: theme,
    });
    var seriesIndex = 0;
    for (var i = 0; i < frame.fields.length; i++) {
        if (i === 0) {
            continue;
        }
        var field = frame.fields[i];
        var config = field.config;
        var customConfig = __assign(__assign({}, defaultConfig), config.custom);
        field.state.seriesIndex = seriesIndex++;
        // const scaleKey = config.unit || FIXED_UNIT;
        // const colorMode = getFieldColorModeForField(field);
        builder.addSeries({
            scaleKey: FIXED_UNIT,
            pathBuilder: coreConfig.drawPaths,
            pointsBuilder: coreConfig.drawPoints,
            //colorMode,
            lineWidth: customConfig.lineWidth,
            fillOpacity: customConfig.fillOpacity,
            theme: theme,
            show: !((_b = customConfig.hideFrom) === null || _b === void 0 ? void 0 : _b.viz),
            thresholds: config.thresholds,
            // The following properties are not used in the uPlot config, but are utilized as transport for legend config
            dataFrameFieldIndex: (_c = field.state) === null || _c === void 0 ? void 0 : _c.origin,
        });
    }
    return builder;
};
export function getNamesToFieldIndex(frame) {
    var names = new Map();
    for (var i = 0; i < frame.fields.length; i++) {
        names.set(getFieldDisplayName(frame.fields[i], frame), i);
    }
    return names;
}
/**
 * If any sequential duplicate values exist, this will return a new array
 * with the future values set to undefined.
 *
 * in:  1,        1,undefined,        1,2,        2,null,2,3
 * out: 1,undefined,undefined,undefined,2,undefined,null,2,3
 */
export function unsetSameFutureValues(values) {
    var prevVal = values[0];
    var clone = undefined;
    for (var i = 1; i < values.length; i++) {
        var value = values[i];
        if (value === null) {
            prevVal = null;
        }
        else {
            if (value === prevVal) {
                if (!clone) {
                    clone = __spreadArray([], __read(values), false);
                }
                clone[i] = undefined;
            }
            else if (value != null) {
                prevVal = value;
            }
        }
    }
    return clone;
}
/**
 * Merge values by the threshold
 */
export function mergeThresholdValues(field, theme) {
    var thresholds = field.config.thresholds;
    if (field.type !== FieldType.number || !thresholds || !thresholds.steps.length) {
        return undefined;
    }
    var items = getThresholdItems(field.config, theme);
    if (items.length !== thresholds.steps.length) {
        return undefined; // should not happen
    }
    var thresholdToText = new Map();
    var textToColor = new Map();
    for (var i = 0; i < items.length; i++) {
        thresholdToText.set(thresholds.steps[i], items[i].label);
        textToColor.set(items[i].label, items[i].color);
    }
    var prev = undefined;
    var input = field.values.toArray();
    var vals = new Array(field.values.length);
    if (thresholds.mode === ThresholdsMode.Percentage) {
        var _a = getFieldConfigWithMinMax(field), min_1 = _a.min, max = _a.max;
        var delta_1 = max - min_1;
        input = input.map(function (v) {
            if (v == null) {
                return v;
            }
            return ((v - min_1) / delta_1) * 100;
        });
    }
    for (var i = 0; i < vals.length; i++) {
        var v = input[i];
        if (v == null) {
            vals[i] = v;
            prev = undefined;
        }
        var active = getActiveThreshold(v, thresholds.steps);
        if (active === prev) {
            vals[i] = undefined;
        }
        else {
            vals[i] = thresholdToText.get(active);
        }
        prev = active;
    }
    return __assign(__assign({}, field), { type: FieldType.string, values: new ArrayVector(vals), display: function (value) { return ({
            text: value,
            color: textToColor.get(value),
            numeric: NaN,
        }); } });
}
// This will return a set of frames with only graphable values included
export function prepareTimelineFields(series, mergeValues, theme) {
    var e_1, _a, e_2, _b;
    var _c;
    if (!(series === null || series === void 0 ? void 0 : series.length)) {
        return { warn: 'No data in response' };
    }
    var hasTimeseries = false;
    var frames = [];
    try {
        for (var series_1 = __values(series), series_1_1 = series_1.next(); !series_1_1.done; series_1_1 = series_1.next()) {
            var frame = series_1_1.value;
            var isTimeseries = false;
            var changed = false;
            var fields = [];
            try {
                for (var _d = (e_2 = void 0, __values(frame.fields)), _e = _d.next(); !_e.done; _e = _d.next()) {
                    var field = _e.value;
                    switch (field.type) {
                        case FieldType.time:
                            isTimeseries = true;
                            hasTimeseries = true;
                            fields.push(field);
                            break;
                        case FieldType.number:
                            if (mergeValues && ((_c = field.config.color) === null || _c === void 0 ? void 0 : _c.mode) === FieldColorModeId.Thresholds) {
                                var f = mergeThresholdValues(field, theme);
                                if (f) {
                                    fields.push(f);
                                    changed = true;
                                    continue;
                                }
                            }
                        case FieldType.boolean:
                        case FieldType.string:
                            field = __assign(__assign({}, field), { config: __assign(__assign({}, field.config), { custom: __assign(__assign({}, field.config.custom), { 
                                        // magic value for join() to leave nulls alone
                                        spanNulls: -1 }) }) });
                            if (mergeValues) {
                                var merged = unsetSameFutureValues(field.values.toArray());
                                if (merged) {
                                    fields.push(__assign(__assign({}, field), { values: new ArrayVector(merged) }));
                                    changed = true;
                                    continue;
                                }
                            }
                            fields.push(field);
                            break;
                        default:
                            changed = true;
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_e && !_e.done && (_b = _d.return)) _b.call(_d);
                }
                finally { if (e_2) throw e_2.error; }
            }
            if (isTimeseries && fields.length > 1) {
                hasTimeseries = true;
                if (changed) {
                    frames.push(__assign(__assign({}, frame), { fields: fields }));
                }
                else {
                    frames.push(frame);
                }
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (series_1_1 && !series_1_1.done && (_a = series_1.return)) _a.call(series_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    if (!hasTimeseries) {
        return { warn: 'Data does not have a time field' };
    }
    if (!frames.length) {
        return { warn: 'No graphable fields' };
    }
    return { frames: frames };
}
export function getThresholdItems(fieldConfig, theme) {
    var _a;
    var items = [];
    var thresholds = fieldConfig.thresholds;
    if (!thresholds || !thresholds.steps.length) {
        return items;
    }
    var steps = thresholds.steps;
    var disp = getValueFormat(thresholds.mode === ThresholdsMode.Percentage ? 'percent' : (_a = fieldConfig.unit) !== null && _a !== void 0 ? _a : '');
    var fmt = function (v) { return formattedValueToString(disp(v)); };
    for (var i = 1; i <= steps.length; i++) {
        var step = steps[i - 1];
        items.push({
            label: i === 1 ? "< " + fmt(step.value) : fmt(step.value) + "+",
            color: theme.visualization.getColorByName(step.color),
            yAxis: 1,
        });
    }
    return items;
}
export function prepareTimelineLegendItems(frames, options, theme) {
    var _a, _b;
    if (!frames || options.displayMode === 'hidden') {
        return undefined;
    }
    var fields = allNonTimeFields(frames);
    if (!fields.length) {
        return undefined;
    }
    var items = [];
    var fieldConfig = fields[0].config;
    var colorMode = (_b = (_a = fieldConfig.color) === null || _a === void 0 ? void 0 : _a.mode) !== null && _b !== void 0 ? _b : FieldColorModeId.Fixed;
    var thresholds = fieldConfig.thresholds;
    // If thresholds are enabled show each step in the legend
    if (colorMode === FieldColorModeId.Thresholds && (thresholds === null || thresholds === void 0 ? void 0 : thresholds.steps) && thresholds.steps.length > 1) {
        return getThresholdItems(fieldConfig, theme);
    }
    // If thresholds are enabled show each step in the legend
    if (colorMode.startsWith('continuous')) {
        return undefined; // eventually a color bar
    }
    var stateColors = new Map();
    fields.forEach(function (field) {
        field.values.toArray().forEach(function (v) {
            var state = field.display(v);
            if (state.color) {
                stateColors.set(state.text, state.color);
            }
        });
    });
    stateColors.forEach(function (color, label) {
        if (label.length > 0) {
            items.push({
                label: label,
                color: theme.visualization.getColorByName(color !== null && color !== void 0 ? color : FALLBACK_COLOR),
                yAxis: 1,
            });
        }
    });
    return items;
}
function allNonTimeFields(frames) {
    var e_3, _a, e_4, _b;
    var fields = [];
    try {
        for (var frames_1 = __values(frames), frames_1_1 = frames_1.next(); !frames_1_1.done; frames_1_1 = frames_1.next()) {
            var frame = frames_1_1.value;
            try {
                for (var _c = (e_4 = void 0, __values(frame.fields)), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var field = _d.value;
                    if (field.type !== FieldType.time) {
                        fields.push(field);
                    }
                }
            }
            catch (e_4_1) { e_4 = { error: e_4_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
                }
                finally { if (e_4) throw e_4.error; }
            }
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (frames_1_1 && !frames_1_1.done && (_a = frames_1.return)) _a.call(frames_1);
        }
        finally { if (e_3) throw e_3.error; }
    }
    return fields;
}
export function findNextStateIndex(field, datapointIdx) {
    var end;
    var rightPointer = datapointIdx + 1;
    if (rightPointer >= field.values.length) {
        return null;
    }
    while (end === undefined) {
        if (rightPointer >= field.values.length) {
            return null;
        }
        var rightValue = field.values.get(rightPointer);
        if (rightValue !== undefined) {
            end = rightPointer;
        }
        else {
            rightPointer++;
        }
    }
    return end;
}
//# sourceMappingURL=utils.js.map