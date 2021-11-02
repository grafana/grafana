import { __assign, __read, __values } from "tslib";
import { isNumber } from 'lodash';
import { DashboardCursorSync, DataHoverClearEvent, DataHoverEvent, FieldType, formattedValueToString, getFieldColorModeForField, getFieldSeriesColor, getFieldDisplayName, } from '@grafana/data';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { FIXED_UNIT } from '../GraphNG/GraphNG';
import { AxisPlacement, GraphDrawStyle, GraphTresholdsStyleMode, VisibilityMode, ScaleDirection, ScaleOrientation, } from '@grafana/schema';
import { collectStackingGroups, orderIdsByCalcs, preparePlotData } from '../uPlot/utils';
var defaultFormatter = function (v) { return (v == null ? '-' : v.toFixed(1)); };
var defaultConfig = {
    drawStyle: GraphDrawStyle.Line,
    showPoints: VisibilityMode.Auto,
    axisPlacement: AxisPlacement.Auto,
};
export var preparePlotConfigBuilder = function (_a) {
    var e_1, _b, _c;
    var _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    var frame = _a.frame, theme = _a.theme, timeZone = _a.timeZone, getTimeRange = _a.getTimeRange, eventBus = _a.eventBus, sync = _a.sync, allFrames = _a.allFrames, legend = _a.legend;
    var builder = new UPlotConfigBuilder(timeZone);
    builder.setPrepData(function (prepData) { return preparePlotData(prepData, undefined, legend); });
    // X is the first field in the aligned frame
    var xField = frame.fields[0];
    if (!xField) {
        return builder; // empty frame with no options
    }
    var seriesIndex = 0;
    var xScaleKey = 'x';
    var xScaleUnit = '_x';
    var yScaleKey = '';
    if (xField.type === FieldType.time) {
        xScaleUnit = 'time';
        builder.addScale({
            scaleKey: xScaleKey,
            orientation: ScaleOrientation.Horizontal,
            direction: ScaleDirection.Right,
            isTime: true,
            range: function () {
                var r = getTimeRange();
                return [r.from.valueOf(), r.to.valueOf()];
            },
        });
        builder.addAxis({
            scaleKey: xScaleKey,
            isTime: true,
            placement: AxisPlacement.Bottom,
            timeZone: timeZone,
            theme: theme,
            grid: { show: (_d = xField.config.custom) === null || _d === void 0 ? void 0 : _d.axisGridShow },
        });
    }
    else {
        // Not time!
        if (xField.config.unit) {
            xScaleUnit = xField.config.unit;
        }
        builder.addScale({
            scaleKey: xScaleKey,
            orientation: ScaleOrientation.Horizontal,
            direction: ScaleDirection.Right,
        });
        builder.addAxis({
            scaleKey: xScaleKey,
            placement: AxisPlacement.Bottom,
            theme: theme,
            grid: { show: (_e = xField.config.custom) === null || _e === void 0 ? void 0 : _e.axisGridShow },
        });
    }
    var stackingGroups = new Map();
    var indexByName;
    var _loop_1 = function (i) {
        var field = frame.fields[i];
        var config = field.config;
        var customConfig = __assign(__assign({}, defaultConfig), config.custom);
        if (field === xField || field.type !== FieldType.number) {
            return "continue";
        }
        field.state.seriesIndex = seriesIndex++;
        var fmt = (_f = field.display) !== null && _f !== void 0 ? _f : defaultFormatter;
        var scaleKey = config.unit || FIXED_UNIT;
        var colorMode = getFieldColorModeForField(field);
        var scaleColor = getFieldSeriesColor(field, theme);
        var seriesColor = scaleColor.color;
        // The builder will manage unique scaleKeys and combine where appropriate
        builder.addScale({
            scaleKey: scaleKey,
            orientation: ScaleOrientation.Vertical,
            direction: ScaleDirection.Up,
            distribution: (_g = customConfig.scaleDistribution) === null || _g === void 0 ? void 0 : _g.type,
            log: (_h = customConfig.scaleDistribution) === null || _h === void 0 ? void 0 : _h.log,
            min: field.config.min,
            max: field.config.max,
            softMin: customConfig.axisSoftMin,
            softMax: customConfig.axisSoftMax,
        });
        if (!yScaleKey) {
            yScaleKey = scaleKey;
        }
        if (customConfig.axisPlacement !== AxisPlacement.Hidden) {
            builder.addAxis({
                scaleKey: scaleKey,
                label: customConfig.axisLabel,
                size: customConfig.axisWidth,
                placement: (_j = customConfig.axisPlacement) !== null && _j !== void 0 ? _j : AxisPlacement.Auto,
                formatValue: function (v) { return formattedValueToString(fmt(v)); },
                theme: theme,
                grid: { show: customConfig.axisGridShow },
            });
        }
        var showPoints = customConfig.drawStyle === GraphDrawStyle.Points ? VisibilityMode.Always : customConfig.showPoints;
        var pointsFilter = function () { return null; };
        if (customConfig.spanNulls !== true) {
            pointsFilter = function (u, seriesIdx, show, gaps) {
                var filtered = [];
                var series = u.series[seriesIdx];
                if (!show && gaps && gaps.length) {
                    var _a = __read(series.idxs, 2), firstIdx = _a[0], lastIdx = _a[1];
                    var xData = u.data[0];
                    var firstPos = Math.round(u.valToPos(xData[firstIdx], 'x', true));
                    var lastPos = Math.round(u.valToPos(xData[lastIdx], 'x', true));
                    if (gaps[0][0] === firstPos) {
                        filtered.push(firstIdx);
                    }
                    // show single points between consecutive gaps that share end/start
                    for (var i_1 = 0; i_1 < gaps.length; i_1++) {
                        var thisGap = gaps[i_1];
                        var nextGap = gaps[i_1 + 1];
                        if (nextGap && thisGap[1] === nextGap[0]) {
                            filtered.push(u.posToIdx(thisGap[1], true));
                        }
                    }
                    if (gaps[gaps.length - 1][1] === lastPos) {
                        filtered.push(lastIdx);
                    }
                }
                return filtered.length ? filtered : null;
            };
        }
        var fillOpacity = customConfig.fillOpacity;
        if (customConfig.fillBelowTo && ((_k = field.state) === null || _k === void 0 ? void 0 : _k.origin)) {
            if (!indexByName) {
                indexByName = getNamesToFieldIndex(frame, allFrames);
            }
            var originFrame = allFrames[field.state.origin.frameIndex];
            var originField = originFrame.fields[field.state.origin.fieldIndex];
            var t = indexByName.get(getFieldDisplayName(originField, originFrame, allFrames));
            var b = indexByName.get(customConfig.fillBelowTo);
            if (isNumber(b) && isNumber(t)) {
                builder.addBand({
                    series: [t, b],
                    fill: null, // using null will have the band use fill options from `t`
                });
            }
            if (!fillOpacity) {
                fillOpacity = 35; // default from flot
            }
        }
        builder.addSeries({
            scaleKey: scaleKey,
            showPoints: showPoints,
            pointsFilter: pointsFilter,
            colorMode: colorMode,
            fillOpacity: fillOpacity,
            theme: theme,
            drawStyle: customConfig.drawStyle,
            lineColor: (_l = customConfig.lineColor) !== null && _l !== void 0 ? _l : seriesColor,
            lineWidth: customConfig.lineWidth,
            lineInterpolation: customConfig.lineInterpolation,
            lineStyle: customConfig.lineStyle,
            barAlignment: customConfig.barAlignment,
            barWidthFactor: customConfig.barWidthFactor,
            barMaxWidth: customConfig.barMaxWidth,
            pointSize: customConfig.pointSize,
            spanNulls: customConfig.spanNulls || false,
            show: !((_m = customConfig.hideFrom) === null || _m === void 0 ? void 0 : _m.viz),
            gradientMode: customConfig.gradientMode,
            thresholds: config.thresholds,
            hardMin: field.config.min,
            hardMax: field.config.max,
            softMin: customConfig.axisSoftMin,
            softMax: customConfig.axisSoftMax,
            // The following properties are not used in the uPlot config, but are utilized as transport for legend config
            dataFrameFieldIndex: (_o = field.state) === null || _o === void 0 ? void 0 : _o.origin,
        });
        // Render thresholds in graph
        if (customConfig.thresholdsStyle && config.thresholds) {
            var thresholdDisplay = (_p = customConfig.thresholdsStyle.mode) !== null && _p !== void 0 ? _p : GraphTresholdsStyleMode.Off;
            if (thresholdDisplay !== GraphTresholdsStyleMode.Off) {
                builder.addThresholds({
                    config: customConfig.thresholdsStyle,
                    thresholds: config.thresholds,
                    scaleKey: scaleKey,
                    theme: theme,
                    hardMin: field.config.min,
                    hardMax: field.config.max,
                    softMin: customConfig.axisSoftMin,
                    softMax: customConfig.axisSoftMax,
                });
            }
        }
        collectStackingGroups(field, stackingGroups, seriesIndex);
    };
    for (var i = 1; i < frame.fields.length; i++) {
        _loop_1(i);
    }
    if (stackingGroups.size !== 0) {
        builder.setStacking(true);
        try {
            for (var _q = __values(stackingGroups.entries()), _r = _q.next(); !_r.done; _r = _q.next()) {
                var _s = __read(_r.value, 2), _1 = _s[0], seriesIds = _s[1];
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
                if (_r && !_r.done && (_b = _q.return)) _b.call(_q);
            }
            finally { if (e_1) throw e_1.error; }
        }
    }
    builder.scaleKeys = [xScaleKey, yScaleKey];
    // if hovered value is null, how far we may scan left/right to hover nearest non-null
    var hoverProximityPx = 15;
    var cursor = {
        // this scans left and right from cursor position to find nearest data index with value != null
        // TODO: do we want to only scan past undefined values, but halt at explicit null values?
        dataIdx: function (self, seriesIdx, hoveredIdx, cursorXVal) {
            var seriesData = self.data[seriesIdx];
            if (seriesData[hoveredIdx] == null) {
                var nonNullLft = hoveredIdx, nonNullRgt = hoveredIdx, i = void 0;
                i = hoveredIdx;
                while (nonNullLft === hoveredIdx && i-- > 0) {
                    if (seriesData[i] != null) {
                        nonNullLft = i;
                    }
                }
                i = hoveredIdx;
                while (nonNullRgt === hoveredIdx && i++ < seriesData.length) {
                    if (seriesData[i] != null) {
                        nonNullRgt = i;
                    }
                }
                var xVals = self.data[0];
                var curPos = self.valToPos(cursorXVal, 'x');
                var rgtPos = self.valToPos(xVals[nonNullRgt], 'x');
                var lftPos = self.valToPos(xVals[nonNullLft], 'x');
                var lftDelta = curPos - lftPos;
                var rgtDelta = rgtPos - curPos;
                if (lftDelta <= rgtDelta) {
                    if (lftDelta <= hoverProximityPx) {
                        hoveredIdx = nonNullLft;
                    }
                }
                else {
                    if (rgtDelta <= hoverProximityPx) {
                        hoveredIdx = nonNullRgt;
                    }
                }
            }
            return hoveredIdx;
        },
    };
    if (sync !== DashboardCursorSync.Off) {
        var payload_1 = {
            point: (_c = {},
                _c[xScaleKey] = null,
                _c[yScaleKey] = null,
                _c),
            data: frame,
        };
        var hoverEvent_1 = new DataHoverEvent(payload_1);
        cursor.sync = {
            key: '__global_',
            filters: {
                pub: function (type, src, x, y, w, h, dataIdx) {
                    payload_1.rowIndex = dataIdx;
                    if (x < 0 && y < 0) {
                        payload_1.point[xScaleUnit] = null;
                        payload_1.point[yScaleKey] = null;
                        eventBus.publish(new DataHoverClearEvent());
                    }
                    else {
                        // convert the points
                        payload_1.point[xScaleUnit] = src.posToVal(x, xScaleKey);
                        payload_1.point[yScaleKey] = src.posToVal(y, yScaleKey);
                        eventBus.publish(hoverEvent_1);
                        hoverEvent_1.payload.down = undefined;
                    }
                    return true;
                },
            },
            // ??? setSeries: syncMode === DashboardCursorSync.Tooltip,
            scales: builder.scaleKeys,
            match: [function () { return true; }, function () { return true; }],
        };
    }
    builder.setSync();
    builder.setCursor(cursor);
    return builder;
};
export function getNamesToFieldIndex(frame, allFrames) {
    var _a;
    var originNames = new Map();
    for (var i = 0; i < frame.fields.length; i++) {
        var origin_1 = (_a = frame.fields[i].state) === null || _a === void 0 ? void 0 : _a.origin;
        if (origin_1) {
            originNames.set(getFieldDisplayName(allFrames[origin_1.frameIndex].fields[origin_1.fieldIndex], allFrames[origin_1.frameIndex], allFrames), i);
        }
    }
    return originNames;
}
//# sourceMappingURL=utils.js.map