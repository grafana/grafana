import { __assign, __read, __spreadArray, __values } from "tslib";
import { FieldColorModeId, fieldColorModeRegistry, getDisplayProcessor, getFieldColorModeForField, getFieldDisplayName, getFieldSeriesColor, } from '@grafana/data';
import { AxisPlacement, ScaleDirection, ScaleOrientation, VisibilityMode } from '@grafana/schema';
import { UPlotConfigBuilder } from '@grafana/ui';
import { findFieldIndex, getScaledDimensionForField, ScaleDimensionMode, } from 'app/features/dimensions';
import { config } from '@grafana/runtime';
import { defaultScatterConfig, ScatterLineMode } from './models.gen';
import { pointWithin, Quadtree } from '../barchart/quadtree';
import { alpha } from '@grafana/data/src/themes/colorManipulator';
import uPlot from 'uplot';
import { isGraphable } from './dims';
/**
 * This is called when options or structure rev changes
 */
export function prepScatter(options, getData, theme, ttip) {
    var series;
    var builder;
    try {
        series = prepSeries(options, getData());
        builder = prepConfig(getData, series, theme, ttip);
    }
    catch (e) {
        console.log('prepScatter ERROR', e);
        return {
            error: e.message,
            series: [],
        };
    }
    return {
        series: series,
        builder: builder,
    };
}
function getScatterSeries(seriesIndex, frames, frameIndex, xIndex, yIndex, dims) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    var frame = frames[frameIndex];
    var y = frame.fields[yIndex];
    var state = (_a = y.state) !== null && _a !== void 0 ? _a : {};
    state.seriesIndex = seriesIndex;
    y.state = state;
    // Color configs
    //----------------
    var seriesColor = dims.pointColorFixed
        ? config.theme2.visualization.getColorByName(dims.pointColorFixed)
        : getFieldSeriesColor(y, config.theme2).color;
    var pointColor = function () { return seriesColor; };
    var fieldConfig = __assign(__assign({}, defaultScatterConfig), y.config.custom);
    var pointColorMode = fieldColorModeRegistry.get(FieldColorModeId.PaletteClassic);
    if (dims.pointColorIndex) {
        var f = frames[frameIndex].fields[dims.pointColorIndex];
        if (f) {
            var disp_1 = (_b = f.display) !== null && _b !== void 0 ? _b : getDisplayProcessor({
                field: f,
                theme: config.theme2,
            });
            pointColorMode = getFieldColorModeForField(y);
            if (pointColorMode.isByValue) {
                var index_1 = dims.pointColorIndex;
                pointColor = function (frame) {
                    // Yes we can improve this later
                    return frame.fields[index_1].values.toArray().map(function (v) { return disp_1(v).color; });
                };
            }
            else {
                seriesColor = pointColorMode.getCalculator(f, config.theme2)(f.values.get(0), 1);
                pointColor = function () { return seriesColor; };
            }
        }
    }
    // Size configs
    //----------------
    var pointSizeHints = dims.pointSizeConfig;
    var pointSizeFixed = (_g = (_d = (_c = dims.pointSizeConfig) === null || _c === void 0 ? void 0 : _c.fixed) !== null && _d !== void 0 ? _d : (_f = (_e = y.config.custom) === null || _e === void 0 ? void 0 : _e.pointSizeConfig) === null || _f === void 0 ? void 0 : _f.fixed) !== null && _g !== void 0 ? _g : 5;
    var pointSize = function () { return pointSizeFixed; };
    if (dims.pointSizeIndex) {
        pointSize = function (frame) {
            var s = getScaledDimensionForField(frame.fields[dims.pointSizeIndex], dims.pointSizeConfig, ScaleDimensionMode.Quadratic);
            var vals = Array(frame.length);
            for (var i = 0; i < frame.length; i++) {
                vals[i] = s.get(i);
            }
            return vals;
        };
    }
    else {
        pointSizeHints = {
            fixed: pointSizeFixed,
            min: pointSizeFixed,
            max: pointSizeFixed,
        };
    }
    // Series config
    //----------------
    var name = getFieldDisplayName(y, frame, frames);
    return {
        name: name,
        frame: function (frames) { return frames[frameIndex]; },
        x: function (frame) { return frame.fields[xIndex]; },
        y: function (frame) { return frame.fields[yIndex]; },
        legend: function (frame) {
            return [
                {
                    label: name,
                    color: seriesColor,
                    getItemKey: function () { return name; },
                    yAxis: yIndex, // << but not used
                },
            ];
        },
        line: (_h = fieldConfig.line) !== null && _h !== void 0 ? _h : ScatterLineMode.None,
        lineWidth: (_j = fieldConfig.lineWidth) !== null && _j !== void 0 ? _j : 2,
        lineStyle: fieldConfig.lineStyle,
        lineColor: function () { return seriesColor; },
        point: fieldConfig.point,
        pointSize: pointSize,
        pointColor: pointColor,
        pointSymbol: function (frame, from) { return 'circle'; },
        label: VisibilityMode.Never,
        labelValue: function () { return ''; },
        hints: {
            pointSize: pointSizeHints,
            pointColor: {
                mode: pointColorMode,
            },
        },
    };
}
function prepSeries(options, frames) {
    var e_1, _a;
    var _b, _c, _d, _e, _f, _g;
    var seriesIndex = 0;
    if (!frames.length) {
        throw 'missing data';
    }
    if (options.mode === 'explicit') {
        if ((_b = options.series) === null || _b === void 0 ? void 0 : _b.length) {
            try {
                for (var _h = __values(options.series), _j = _h.next(); !_j.done; _j = _h.next()) {
                    var series = _j.value;
                    if (!(series === null || series === void 0 ? void 0 : series.x)) {
                        throw 'Select X dimension';
                    }
                    if (!(series === null || series === void 0 ? void 0 : series.y)) {
                        throw 'Select Y dimension';
                    }
                    for (var frameIndex_1 = 0; frameIndex_1 < frames.length; frameIndex_1++) {
                        var frame_1 = frames[frameIndex_1];
                        var xIndex_1 = findFieldIndex(frame_1, series.x);
                        if (xIndex_1 != null) {
                            // TODO: this should find multiple y fields
                            var yIndex = findFieldIndex(frame_1, series.y);
                            if (yIndex == null) {
                                throw 'Y must be in the same frame as X';
                            }
                            var dims_1 = {
                                pointColorFixed: (_c = series.pointColor) === null || _c === void 0 ? void 0 : _c.fixed,
                                pointColorIndex: findFieldIndex(frame_1, (_d = series.pointColor) === null || _d === void 0 ? void 0 : _d.field),
                                pointSizeConfig: series.pointSize,
                                pointSizeIndex: findFieldIndex(frame_1, (_e = series.pointSize) === null || _e === void 0 ? void 0 : _e.field),
                            };
                            return [getScatterSeries(seriesIndex++, frames, frameIndex_1, xIndex_1, yIndex, dims_1)];
                        }
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_j && !_j.done && (_a = _h.return)) _a.call(_h);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
    }
    // Default behavior
    var dims = (_f = options.dims) !== null && _f !== void 0 ? _f : {};
    var frameIndex = (_g = dims.frame) !== null && _g !== void 0 ? _g : 0;
    var frame = frames[frameIndex];
    var numericIndicies = [];
    var xIndex = findFieldIndex(frame, dims.x);
    for (var i = 0; i < frame.fields.length; i++) {
        if (isGraphable(frame.fields[i])) {
            if (xIndex == null || i === xIndex) {
                xIndex = i;
                continue;
            }
            if (dims.exclude && dims.exclude.includes(getFieldDisplayName(frame.fields[i], frame, frames))) {
                continue; // skip
            }
            numericIndicies.push(i);
        }
    }
    if (xIndex == null) {
        throw 'Missing X dimension';
    }
    if (!numericIndicies.length) {
        throw 'No Y values';
    }
    return numericIndicies.map(function (yIndex) { return getScatterSeries(seriesIndex++, frames, frameIndex, xIndex, yIndex, {}); });
}
//const prepConfig: UPlotConfigPrepFnXY<XYChartOptions> = ({ frames, series, theme }) => {
var prepConfig = function (getData, scatterSeries, theme, ttip) {
    var qt;
    var hRect;
    function drawBubblesFactory(opts) {
        var drawBubbles = function (u, seriesIdx, idx0, idx1) {
            uPlot.orient(u, seriesIdx, function (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim, moveTo, lineTo, rect, arc) {
                var _a, _b;
                var scatterInfo = scatterSeries[seriesIdx - 1];
                var d = u.data[seriesIdx];
                var showLine = scatterInfo.line !== ScatterLineMode.None;
                var showPoints = scatterInfo.point === VisibilityMode.Always;
                if (!showPoints && scatterInfo.point === VisibilityMode.Auto) {
                    showPoints = d[0].length < 1000;
                }
                // always show something
                if (!showPoints && !showLine) {
                    showLine = true;
                }
                var strokeWidth = 1;
                u.ctx.save();
                u.ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
                u.ctx.clip();
                u.ctx.fillStyle = series.fill(); // assumes constant
                u.ctx.strokeStyle = series.stroke();
                u.ctx.lineWidth = strokeWidth;
                var deg360 = 2 * Math.PI;
                // leon forgot to add these to the uPlot's Scale interface, but they exist!
                //let xKey = scaleX.key as string;
                //let yKey = scaleY.key as string;
                var xKey = series.facets[0].scale;
                var yKey = series.facets[1].scale;
                var pointHints = scatterInfo.hints.pointSize;
                var colorByValue = scatterInfo.hints.pointColor.mode.isByValue;
                var maxSize = ((_a = pointHints.max) !== null && _a !== void 0 ? _a : pointHints.fixed) * devicePixelRatio;
                // todo: this depends on direction & orientation
                // todo: calc once per redraw, not per path
                var filtLft = u.posToVal(-maxSize / 2, xKey);
                var filtRgt = u.posToVal(u.bbox.width / devicePixelRatio + maxSize / 2, xKey);
                var filtBtm = u.posToVal(u.bbox.height / devicePixelRatio + maxSize / 2, yKey);
                var filtTop = u.posToVal(-maxSize / 2, yKey);
                var sizes = opts.disp.size.values(u, seriesIdx);
                var pointColors = opts.disp.color.values(u, seriesIdx);
                var pointAlpha = opts.disp.color.alpha(u, seriesIdx);
                var linePath = showLine ? new Path2D() : null;
                for (var i = 0; i < d[0].length; i++) {
                    var xVal = d[0][i];
                    var yVal = d[1][i];
                    var size = sizes[i] * devicePixelRatio;
                    if (xVal >= filtLft && xVal <= filtRgt && yVal >= filtBtm && yVal <= filtTop) {
                        var cx = valToPosX(xVal, scaleX, xDim, xOff);
                        var cy = valToPosY(yVal, scaleY, yDim, yOff);
                        if (showLine) {
                            linePath.lineTo(cx, cy);
                        }
                        if (showPoints) {
                            u.ctx.moveTo(cx + size / 2, cy);
                            u.ctx.beginPath();
                            u.ctx.arc(cx, cy, size / 2, 0, deg360);
                            if (colorByValue) {
                                u.ctx.fillStyle = pointAlpha[i];
                                u.ctx.strokeStyle = pointColors[i];
                            }
                            u.ctx.fill();
                            u.ctx.stroke();
                            opts.each(u, seriesIdx, i, cx - size / 2 - strokeWidth / 2, cy - size / 2 - strokeWidth / 2, size + strokeWidth, size + strokeWidth);
                        }
                    }
                }
                if (showLine) {
                    var frame = scatterInfo.frame(getData());
                    u.ctx.strokeStyle = scatterInfo.lineColor(frame);
                    u.ctx.lineWidth = scatterInfo.lineWidth * devicePixelRatio;
                    var lineStyle = scatterInfo.lineStyle;
                    if (lineStyle && lineStyle.fill !== 'solid') {
                        if (lineStyle.fill === 'dot') {
                            u.ctx.lineCap = 'round';
                        }
                        u.ctx.setLineDash((_b = lineStyle.dash) !== null && _b !== void 0 ? _b : [10, 10]);
                    }
                    u.ctx.stroke(linePath);
                }
                u.ctx.restore();
            });
            return null;
        };
        return drawBubbles;
    }
    var drawBubbles = drawBubblesFactory({
        disp: {
            size: {
                //unit: 3, // raw CSS pixels
                values: function (u, seriesIdx) {
                    return u.data[seriesIdx][2]; // already contains final pixel geometry
                    //let [minValue, maxValue] = getSizeMinMax(u);
                    //return u.data[seriesIdx][2].map(v => getSize(v, minValue, maxValue));
                },
            },
            color: {
                // string values
                values: function (u, seriesIdx) {
                    return u.data[seriesIdx][3];
                },
                alpha: function (u, seriesIdx) {
                    return u.data[seriesIdx][4];
                },
            },
        },
        each: function (u, seriesIdx, dataIdx, lft, top, wid, hgt) {
            // we get back raw canvas coords (included axes & padding). translate to the plotting area origin
            lft -= u.bbox.left;
            top -= u.bbox.top;
            qt.add({ x: lft, y: top, w: wid, h: hgt, sidx: seriesIdx, didx: dataIdx });
        },
    });
    var builder = new UPlotConfigBuilder();
    builder.setCursor({
        drag: { setScale: true },
        dataIdx: function (u, seriesIdx) {
            if (seriesIdx === 1) {
                hRect = null;
                var dist_1 = Infinity;
                var cx_1 = u.cursor.left * devicePixelRatio;
                var cy_1 = u.cursor.top * devicePixelRatio;
                qt.get(cx_1, cy_1, 1, 1, function (o) {
                    if (pointWithin(cx_1, cy_1, o.x, o.y, o.x + o.w, o.y + o.h)) {
                        var ocx = o.x + o.w / 2;
                        var ocy = o.y + o.h / 2;
                        var dx = ocx - cx_1;
                        var dy = ocy - cy_1;
                        var d = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
                        // test against radius for actual hover
                        if (d <= o.w / 2) {
                            // only hover bbox with closest distance
                            if (d <= dist_1) {
                                dist_1 = d;
                                hRect = o;
                            }
                        }
                    }
                });
            }
            return hRect && seriesIdx === hRect.sidx ? hRect.didx : null;
        },
        points: {
            size: function (u, seriesIdx) {
                return hRect && seriesIdx === hRect.sidx ? hRect.w / devicePixelRatio : 0;
            },
            fill: function (u, seriesIdx) { return 'rgba(255,255,255,0.4)'; },
        },
    });
    // clip hover points/bubbles to plotting area
    builder.addHook('init', function (u, r) {
        u.over.style.overflow = 'hidden';
    });
    var rect;
    // rect of .u-over (grid area)
    builder.addHook('syncRect', function (u, r) {
        rect = r;
    });
    builder.addHook('setLegend', function (u) {
        // console.log('TTIP???', u.cursor.idxs);
        if (u.cursor.idxs != null) {
            for (var i = 0; i < u.cursor.idxs.length; i++) {
                var sel = u.cursor.idxs[i];
                if (sel != null) {
                    ttip({
                        scatterIndex: i - 1,
                        xIndex: sel,
                        pageX: rect.left + u.cursor.left,
                        pageY: rect.top + u.cursor.top,
                    });
                    return; // only show the first one
                }
            }
        }
        ttip(undefined);
    });
    builder.addHook('drawClear', function (u) {
        qt = qt || new Quadtree(0, 0, u.bbox.width, u.bbox.height);
        qt.clear();
        // force-clear the path cache to cause drawBars() to rebuild new quadtree
        u.series.forEach(function (s, i) {
            if (i > 0) {
                // @ts-ignore
                s._paths = null;
            }
        });
    });
    builder.setMode(2);
    var frames = getData();
    var xField = scatterSeries[0].x(scatterSeries[0].frame(frames));
    builder.addScale({
        scaleKey: 'x',
        isTime: false,
        orientation: ScaleOrientation.Horizontal,
        direction: ScaleDirection.Right,
        range: function (u, min, max) { return [min, max]; },
    });
    builder.addAxis({
        scaleKey: 'x',
        placement: AxisPlacement.Bottom,
        theme: theme,
        label: xField.config.custom.axisLabel,
    });
    scatterSeries.forEach(function (s) {
        var _a;
        var frame = s.frame(frames);
        var field = s.y(frame);
        var lineColor = s.lineColor(frame);
        var pointColor = asSingleValue(frame, s.pointColor);
        //const lineColor = s.lineColor(frame);
        //const lineWidth = s.lineWidth;
        var scaleKey = (_a = field.config.unit) !== null && _a !== void 0 ? _a : 'y';
        builder.addScale({
            scaleKey: scaleKey,
            orientation: ScaleOrientation.Vertical,
            direction: ScaleDirection.Up,
            range: function (u, min, max) { return [min, max]; },
        });
        builder.addAxis({
            scaleKey: scaleKey,
            theme: theme,
            label: field.config.custom.axisLabel,
            values: function (u, splits) { return splits.map(function (s) { return field.display(s).text; }); },
        });
        builder.addSeries({
            facets: [
                {
                    scale: 'x',
                    auto: true,
                },
                {
                    scale: scaleKey,
                    auto: true,
                },
            ],
            pathBuilder: drawBubbles,
            theme: theme,
            scaleKey: '',
            lineColor: lineColor,
            fillColor: alpha(pointColor, 0.5),
        });
    });
    /*
    builder.setPrepData((frames) => {
      let seriesData = lookup.fieldMaps.flatMap((f, i) => {
        let { fields } = frames[i];
  
        return f.y.map((yIndex, frameSeriesIndex) => {
          let xValues = fields[f.x[frameSeriesIndex]].values.toArray();
          let yValues = fields[f.y[frameSeriesIndex]].values.toArray();
          let sizeValues = f.size![frameSeriesIndex](frames[i]);
  
          if (!Array.isArray(sizeValues)) {
            sizeValues = Array(xValues.length).fill(sizeValues);
          }
  
          return [xValues, yValues, sizeValues];
        });
      });
  
      return [null, ...seriesData];
    });
    */
    return builder;
};
/**
 * This is called everytime the data changes
 *
 * from?  is this where we would support that?  -- need the previous values
 */
export function prepData(info, data, from) {
    if (info.error) {
        return [null];
    }
    return __spreadArray([
        null
    ], __read(info.series.map(function (s, idx) {
        var frame = s.frame(data);
        var colorValues;
        var colorAlphaValues;
        var r = s.pointColor(frame);
        if (Array.isArray(r)) {
            colorValues = r;
            colorAlphaValues = r.map(function (c) { return alpha(c, 0.5); });
        }
        else {
            colorValues = Array(frame.length).fill(r);
            colorAlphaValues = Array(frame.length).fill(alpha(r, 0.5));
        }
        return [
            s.x(frame).values.toArray(),
            s.y(frame).values.toArray(),
            asArray(frame, s.pointSize),
            colorValues,
            colorAlphaValues,
        ];
    })), false);
}
function asArray(frame, lookup) {
    var r = lookup(frame);
    if (Array.isArray(r)) {
        return r;
    }
    return Array(frame.length).fill(r);
}
function asSingleValue(frame, lookup) {
    var r = lookup(frame);
    if (Array.isArray(r)) {
        return r[0];
    }
    return r;
}
//# sourceMappingURL=scatter.js.map