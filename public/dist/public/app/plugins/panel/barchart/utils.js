import { __assign, __read, __values } from "tslib";
import { ArrayVector, FieldType, formattedValueToString, getDisplayProcessor, getFieldColorModeForField, getFieldSeriesColor, MutableDataFrame, VizOrientation, } from '@grafana/data';
import { defaultBarChartFieldConfig } from './types';
import { getConfig } from './bars';
import { AxisPlacement, ScaleDirection, ScaleDistribution, ScaleOrientation, StackingMode, } from '@grafana/schema';
import { FIXED_UNIT, UPlotConfigBuilder } from '@grafana/ui';
import { collectStackingGroups, orderIdsByCalcs } from '../../../../../packages/grafana-ui/src/components/uPlot/utils';
import { orderBy } from 'lodash';
/** @alpha */
function getBarCharScaleOrientation(orientation) {
    if (orientation === VizOrientation.Vertical) {
        return {
            xOri: ScaleOrientation.Horizontal,
            xDir: ScaleDirection.Right,
            yOri: ScaleOrientation.Vertical,
            yDir: ScaleDirection.Up,
        };
    }
    return {
        xOri: ScaleOrientation.Vertical,
        xDir: ScaleDirection.Down,
        yOri: ScaleOrientation.Horizontal,
        yDir: ScaleDirection.Right,
    };
}
export var preparePlotConfigBuilder = function (_a) {
    var e_1, _b;
    var _c;
    var frame = _a.frame, theme = _a.theme, orientation = _a.orientation, showValue = _a.showValue, groupWidth = _a.groupWidth, barWidth = _a.barWidth, stacking = _a.stacking, text = _a.text, rawValue = _a.rawValue, allFrames = _a.allFrames, legend = _a.legend;
    var builder = new UPlotConfigBuilder();
    var defaultValueFormatter = function (seriesIdx, value) {
        return formattedValueToString(frame.fields[seriesIdx].display(value));
    };
    // bar orientation -> x scale orientation & direction
    var vizOrientation = getBarCharScaleOrientation(orientation);
    var formatValue = defaultValueFormatter;
    // Use bar width when only one field
    if (frame.fields.length === 2) {
        groupWidth = barWidth;
        barWidth = 1;
    }
    var opts = {
        xOri: vizOrientation.xOri,
        xDir: vizOrientation.xDir,
        groupWidth: groupWidth,
        barWidth: barWidth,
        stacking: stacking,
        rawValue: rawValue,
        formatValue: formatValue,
        text: text,
        showValue: showValue,
        legend: legend,
    };
    var config = getConfig(opts, theme);
    builder.setCursor(config.cursor);
    builder.addHook('init', config.init);
    builder.addHook('drawClear', config.drawClear);
    builder.addHook('draw', config.draw);
    builder.setTooltipInterpolator(config.interpolateTooltip);
    builder.setPrepData(config.prepData);
    builder.addScale({
        scaleKey: 'x',
        isTime: false,
        distribution: ScaleDistribution.Ordinal,
        orientation: vizOrientation.xOri,
        direction: vizOrientation.xDir,
    });
    builder.addAxis({
        scaleKey: 'x',
        isTime: false,
        placement: vizOrientation.xOri === 0 ? AxisPlacement.Bottom : AxisPlacement.Left,
        splits: config.xSplits,
        values: config.xValues,
        grid: { show: false },
        ticks: false,
        gap: 15,
        theme: theme,
    });
    var seriesIndex = 0;
    var legendOrdered = isLegendOrdered(legend);
    var stackingGroups = new Map();
    var _loop_1 = function (i) {
        var field = frame.fields[i];
        seriesIndex++;
        var customConfig = __assign(__assign({}, defaultBarChartFieldConfig), field.config.custom);
        var scaleKey = field.config.unit || FIXED_UNIT;
        var colorMode = getFieldColorModeForField(field);
        var scaleColor = getFieldSeriesColor(field, theme);
        var seriesColor = scaleColor.color;
        builder.addSeries({
            scaleKey: scaleKey,
            pxAlign: true,
            lineWidth: customConfig.lineWidth,
            lineColor: seriesColor,
            fillOpacity: customConfig.fillOpacity,
            theme: theme,
            colorMode: colorMode,
            pathBuilder: config.barsBuilder,
            show: !((_c = customConfig.hideFrom) === null || _c === void 0 ? void 0 : _c.viz),
            gradientMode: customConfig.gradientMode,
            thresholds: field.config.thresholds,
            hardMin: field.config.min,
            hardMax: field.config.max,
            softMin: customConfig.axisSoftMin,
            softMax: customConfig.axisSoftMax,
            // The following properties are not used in the uPlot config, but are utilized as transport for legend config
            // PlotLegend currently gets unfiltered DataFrame[], so index must be into that field array, not the prepped frame's which we're iterating here
            dataFrameFieldIndex: {
                fieldIndex: legendOrdered
                    ? i
                    : allFrames[0].fields.findIndex(function (f) { var _a; return f.type === FieldType.number && ((_a = f.state) === null || _a === void 0 ? void 0 : _a.seriesIndex) === seriesIndex - 1; }),
                frameIndex: 0,
            },
        });
        // The builder will manage unique scaleKeys and combine where appropriate
        builder.addScale({
            scaleKey: scaleKey,
            min: field.config.min,
            max: field.config.max,
            softMin: customConfig.axisSoftMin,
            softMax: customConfig.axisSoftMax,
            orientation: vizOrientation.yOri,
            direction: vizOrientation.yDir,
        });
        if (customConfig.axisPlacement !== AxisPlacement.Hidden) {
            var placement = customConfig.axisPlacement;
            if (!placement || placement === AxisPlacement.Auto) {
                placement = AxisPlacement.Left;
            }
            if (vizOrientation.xOri === 1) {
                if (placement === AxisPlacement.Left) {
                    placement = AxisPlacement.Bottom;
                }
                if (placement === AxisPlacement.Right) {
                    placement = AxisPlacement.Top;
                }
            }
            builder.addAxis({
                scaleKey: scaleKey,
                label: customConfig.axisLabel,
                size: customConfig.axisWidth,
                placement: placement,
                formatValue: function (v) { return formattedValueToString(field.display(v)); },
                theme: theme,
                grid: { show: customConfig.axisGridShow },
            });
        }
        collectStackingGroups(field, stackingGroups, seriesIndex);
    };
    // iterate the y values
    for (var i = 1; i < frame.fields.length; i++) {
        _loop_1(i);
    }
    if (stackingGroups.size !== 0) {
        builder.setStacking(true);
        try {
            for (var _d = __values(stackingGroups.entries()), _e = _d.next(); !_e.done; _e = _d.next()) {
                var _f = __read(_e.value, 2), _1 = _f[0], seriesIds = _f[1];
                var seriesIdxs = orderIdsByCalcs({ ids: seriesIds, legend: legend, frame: frame });
                for (var j = seriesIdxs.length - 1; j > 0; j--) {
                    builder.addBand({
                        series: [seriesIdxs[j], seriesIdxs[j - 1]],
                    });
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_e && !_e.done && (_b = _d.return)) _b.call(_d);
            }
            finally { if (e_1) throw e_1.error; }
        }
    }
    return builder;
};
/** @internal */
export function preparePlotFrame(data) {
    var e_2, _a;
    var firstFrame = data[0];
    var firstString = firstFrame.fields.find(function (f) { return f.type === FieldType.string; });
    if (!firstString) {
        throw new Error('No string field in DF');
    }
    var resultFrame = new MutableDataFrame();
    resultFrame.addField(firstString);
    try {
        for (var _b = __values(firstFrame.fields), _c = _b.next(); !_c.done; _c = _b.next()) {
            var f = _c.value;
            if (f.type === FieldType.number) {
                resultFrame.addField(f);
            }
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return resultFrame;
}
/** @internal */
export function prepareGraphableFrames(series, theme, options) {
    var e_3, _a, e_4, _b;
    var _c;
    if (!(series === null || series === void 0 ? void 0 : series.length)) {
        return { warn: 'No data in response' };
    }
    var frames = [];
    var firstFrame = series[0];
    if (!firstFrame.fields.some(function (f) { return f.type === FieldType.string; })) {
        return {
            warn: 'Bar charts requires a string field',
        };
    }
    if (!firstFrame.fields.some(function (f) { return f.type === FieldType.number; })) {
        return {
            warn: 'No numeric fields found',
        };
    }
    var legendOrdered = isLegendOrdered(options.legend);
    var seriesIndex = 0;
    try {
        for (var series_1 = __values(series), series_1_1 = series_1.next(); !series_1_1.done; series_1_1 = series_1.next()) {
            var frame = series_1_1.value;
            var fields = [];
            try {
                for (var _d = (e_4 = void 0, __values(frame.fields)), _e = _d.next(); !_e.done; _e = _d.next()) {
                    var field = _e.value;
                    if (field.type === FieldType.number) {
                        field.state = (_c = field.state) !== null && _c !== void 0 ? _c : {};
                        field.state.seriesIndex = seriesIndex++;
                        var copy = __assign(__assign({}, field), { config: __assign(__assign({}, field.config), { custom: __assign(__assign({}, field.config.custom), { stacking: {
                                        group: '_',
                                        mode: options.stacking,
                                    } }) }), values: new ArrayVector(field.values.toArray().map(function (v) {
                                if (!(Number.isFinite(v) || v == null)) {
                                    return null;
                                }
                                return v;
                            })) });
                        if (options.stacking === StackingMode.Percent) {
                            copy.config.unit = 'percentunit';
                            copy.display = getDisplayProcessor({ field: copy, theme: theme });
                        }
                        fields.push(copy);
                    }
                    else {
                        fields.push(__assign({}, field));
                    }
                }
            }
            catch (e_4_1) { e_4 = { error: e_4_1 }; }
            finally {
                try {
                    if (_e && !_e.done && (_b = _d.return)) _b.call(_d);
                }
                finally { if (e_4) throw e_4.error; }
            }
            var orderedFields = void 0;
            if (legendOrdered) {
                orderedFields = orderBy(fields, function (_a) {
                    var _b;
                    var state = _a.state;
                    return (_b = state === null || state === void 0 ? void 0 : state.calcs) === null || _b === void 0 ? void 0 : _b[options.legend.sortBy.toLowerCase()];
                }, options.legend.sortDesc ? 'desc' : 'asc');
                // The string field needs to be the first one
                if (orderedFields[orderedFields.length - 1].type === FieldType.string) {
                    orderedFields.unshift(orderedFields.pop());
                }
            }
            frames.push(__assign(__assign({}, frame), { fields: orderedFields || fields }));
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (series_1_1 && !series_1_1.done && (_a = series_1.return)) _a.call(series_1);
        }
        finally { if (e_3) throw e_3.error; }
    }
    return { frames: frames };
}
export var isLegendOrdered = function (options) { return Boolean((options === null || options === void 0 ? void 0 : options.sortBy) && options.sortDesc !== null); };
//# sourceMappingURL=utils.js.map