import { __values } from "tslib";
import uPlot from 'uplot';
import { FIXED_UNIT } from '@grafana/ui/src/components/GraphNG/GraphNG';
import { pointWithin, Quadtree } from 'app/plugins/panel/barchart/quadtree';
import { distribute, SPACE_BETWEEN } from 'app/plugins/panel/barchart/distribute';
import { TimelineMode } from './types';
import { VisibilityMode } from '@grafana/schema';
import { alpha } from '@grafana/data/src/themes/colorManipulator';
var round = Math.round, min = Math.min, ceil = Math.ceil;
var textPadding = 2;
var pxRatio = devicePixelRatio;
var laneDistr = SPACE_BETWEEN;
function walk(rowHeight, yIdx, count, dim, draw) {
    distribute(count, rowHeight, laneDistr, yIdx, function (i, offPct, dimPct) {
        var laneOffPx = dim * offPct;
        var laneWidPx = dim * dimPct;
        draw(i, laneOffPx, laneWidPx);
    });
}
/**
 * @internal
 */
export function getConfig(opts) {
    var _a;
    var mode = opts.mode, numSeries = opts.numSeries, isDiscrete = opts.isDiscrete, _b = opts.rowHeight, rowHeight = _b === void 0 ? 0 : _b, _c = opts.colWidth, colWidth = _c === void 0 ? 0 : _c, showValue = opts.showValue, theme = opts.theme, label = opts.label, formatValue = opts.formatValue, _d = opts.alignValue, alignValue = _d === void 0 ? 'left' : _d, getTimeRange = opts.getTimeRange, getValueColor = opts.getValueColor, getFieldConfig = opts.getFieldConfig, onHover = opts.onHover, onLeave = opts.onLeave;
    var qt;
    var hoverMarks = Array(numSeries)
        .fill(null)
        .map(function () {
        var mark = document.createElement('div');
        mark.classList.add('bar-mark');
        mark.style.position = 'absolute';
        mark.style.background = 'rgba(255,255,255,0.2)';
        return mark;
    });
    // Needed for to calculate text positions
    var boxRectsBySeries;
    var resetBoxRectsBySeries = function (count) {
        boxRectsBySeries = Array(numSeries)
            .fill(null)
            .map(function (v) { return Array(count).fill(null); });
    };
    var font = "500 " + Math.round(12 * devicePixelRatio) + "px " + theme.typography.fontFamily;
    var hovered = Array(numSeries).fill(null);
    var size = [colWidth, Infinity];
    var gapFactor = 1 - size[0];
    var maxWidth = ((_a = size[1]) !== null && _a !== void 0 ? _a : Infinity) * pxRatio;
    var fillPaths = new Map();
    var strokePaths = new Map();
    function drawBoxes(ctx) {
        fillPaths.forEach(function (fillPath, fillStyle) {
            ctx.fillStyle = fillStyle;
            ctx.fill(fillPath);
        });
        strokePaths.forEach(function (strokePath, strokeStyle) {
            ctx.strokeStyle = strokeStyle;
            ctx.stroke(strokePath);
        });
        fillPaths.clear();
        strokePaths.clear();
    }
    function putBox(ctx, rect, xOff, yOff, left, top, boxWidth, boxHeight, strokeWidth, seriesIdx, valueIdx, value, discrete) {
        // do not render super small boxes
        if (boxWidth < 1) {
            return;
        }
        var valueColor = getValueColor(seriesIdx + 1, value);
        var fieldConfig = getFieldConfig(seriesIdx);
        var fillColor = getFillColor(fieldConfig, valueColor);
        boxRectsBySeries[seriesIdx][valueIdx] = {
            x: round(left - xOff),
            y: round(top - yOff),
            w: boxWidth,
            h: boxHeight,
            sidx: seriesIdx + 1,
            didx: valueIdx,
            // for computing label contrast
            fillColor: fillColor,
        };
        if (discrete) {
            var fillStyle = fillColor;
            var fillPath = fillPaths.get(fillStyle);
            if (fillPath == null) {
                fillPaths.set(fillStyle, (fillPath = new Path2D()));
            }
            rect(fillPath, left, top, boxWidth, boxHeight);
            if (strokeWidth) {
                var strokeStyle = valueColor;
                var strokePath = strokePaths.get(strokeStyle);
                if (strokePath == null) {
                    strokePaths.set(strokeStyle, (strokePath = new Path2D()));
                }
                rect(strokePath, left + strokeWidth / 2, top + strokeWidth / 2, boxWidth - strokeWidth, boxHeight - strokeWidth);
            }
        }
        else {
            ctx.beginPath();
            rect(ctx, left, top, boxWidth, boxHeight);
            ctx.fillStyle = fillColor;
            ctx.fill();
            if (strokeWidth) {
                ctx.beginPath();
                rect(ctx, left + strokeWidth / 2, top + strokeWidth / 2, boxWidth - strokeWidth, boxHeight - strokeWidth);
                ctx.strokeStyle = valueColor;
                ctx.lineWidth = strokeWidth;
                ctx.stroke();
            }
        }
    }
    var drawPaths = function (u, sidx, idx0, idx1) {
        uPlot.orient(u, sidx, function (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim, moveTo, lineTo, rect) {
            var strokeWidth = round((series.width || 0) * pxRatio);
            var discrete = isDiscrete(sidx);
            u.ctx.save();
            rect(u.ctx, u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
            u.ctx.clip();
            walk(rowHeight, sidx - 1, numSeries, yDim, function (iy, y0, height) {
                if (mode === TimelineMode.Changes) {
                    for (var ix = 0; ix < dataY.length; ix++) {
                        if (dataY[ix] != null) {
                            var left = Math.round(valToPosX(dataX[ix], scaleX, xDim, xOff));
                            var nextIx = ix;
                            while (dataY[++nextIx] === undefined && nextIx < dataY.length) { }
                            // to now (not to end of chart)
                            var right = nextIx === dataY.length
                                ? xOff + xDim + strokeWidth
                                : Math.round(valToPosX(dataX[nextIx], scaleX, xDim, xOff));
                            putBox(u.ctx, rect, xOff, yOff, left, round(yOff + y0), right - left, round(height), strokeWidth, iy, ix, dataY[ix], discrete);
                            ix = nextIx - 1;
                        }
                    }
                }
                else if (mode === TimelineMode.Samples) {
                    var colWid = valToPosX(dataX[1], scaleX, xDim, xOff) - valToPosX(dataX[0], scaleX, xDim, xOff);
                    var gapWid = colWid * gapFactor;
                    var barWid = round(min(maxWidth, colWid - gapWid) - strokeWidth);
                    var xShift = barWid / 2;
                    //let xShift = align === 1 ? 0 : align === -1 ? barWid : barWid / 2;
                    for (var ix = idx0; ix <= idx1; ix++) {
                        if (dataY[ix] != null) {
                            // TODO: all xPos can be pre-computed once for all series in aligned set
                            var left = valToPosX(dataX[ix], scaleX, xDim, xOff);
                            putBox(u.ctx, rect, xOff, yOff, round(left - xShift), round(yOff + y0), barWid, round(height), strokeWidth, iy, ix, dataY[ix], discrete);
                        }
                    }
                }
            });
            if (discrete) {
                u.ctx.lineWidth = strokeWidth;
                drawBoxes(u.ctx);
            }
            u.ctx.restore();
        });
        return null;
    };
    var drawPoints = formatValue == null || showValue === VisibilityMode.Never
        ? false
        : function (u, sidx, i0, i1) {
            u.ctx.save();
            u.ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
            u.ctx.clip();
            u.ctx.font = font;
            u.ctx.textAlign = mode === TimelineMode.Changes ? alignValue : 'center';
            u.ctx.textBaseline = 'middle';
            uPlot.orient(u, sidx, function (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim) {
                var strokeWidth = round((series.width || 0) * pxRatio);
                var y = round(yOff + yMids[sidx - 1]);
                for (var ix = 0; ix < dataY.length; ix++) {
                    if (dataY[ix] != null) {
                        var boxRect = boxRectsBySeries[sidx - 1][ix];
                        // Todo refine this to better know when to not render text (when values do not fit)
                        if (!boxRect || (showValue === VisibilityMode.Auto && boxRect.w < 25)) {
                            continue;
                        }
                        if (boxRect.x >= xDim) {
                            continue; // out of view
                        }
                        // center-aligned
                        var x = round(boxRect.x + xOff + boxRect.w / 2);
                        var txt = formatValue(sidx, dataY[ix]);
                        if (mode === TimelineMode.Changes) {
                            if (alignValue === 'left') {
                                x = round(boxRect.x + xOff + strokeWidth + textPadding);
                            }
                            else if (alignValue === 'right') {
                                x = round(boxRect.x + xOff + boxRect.w - strokeWidth - textPadding);
                            }
                        }
                        // TODO: cache by fillColor to avoid setting ctx for label
                        u.ctx.fillStyle = theme.colors.getContrastText(boxRect.fillColor, 3);
                        u.ctx.fillText(txt, x, y);
                    }
                }
            });
            u.ctx.restore();
            return false;
        };
    var init = function (u) {
        var over = u.over;
        over.style.overflow = 'hidden';
        hoverMarks.forEach(function (m) {
            over.appendChild(m);
        });
    };
    var drawClear = function (u) {
        qt = qt || new Quadtree(0, 0, u.bbox.width, u.bbox.height);
        qt.clear();
        resetBoxRectsBySeries(u.data[0].length);
        // force-clear the path cache to cause drawBars() to rebuild new quadtree
        u.series.forEach(function (s) {
            // @ts-ignore
            s._paths = null;
        });
    };
    function setHoverMark(i, o) {
        var h = hoverMarks[i];
        if (o) {
            h.style.display = '';
            h.style.left = round(o.x / pxRatio) + 'px';
            h.style.top = round(o.y / pxRatio) + 'px';
            h.style.width = round(o.w / pxRatio) + 'px';
            h.style.height = round(o.h / pxRatio) + 'px';
        }
        else {
            h.style.display = 'none';
        }
        hovered[i] = o;
    }
    var hoveredAtCursor;
    function hoverMulti(cx, cy) {
        var foundAtCursor;
        var _loop_1 = function (i) {
            var found;
            if (cx >= 0) {
                var cy2_1 = yMids[i];
                qt.get(cx, cy2_1, 1, 1, function (o) {
                    if (pointWithin(cx, cy2_1, o.x, o.y, o.x + o.w, o.y + o.h)) {
                        found = o;
                        if (Math.abs(cy - cy2_1) <= o.h / 2) {
                            foundAtCursor = o;
                        }
                    }
                });
            }
            if (found) {
                if (found !== hovered[i]) {
                    setHoverMark(i, found);
                }
            }
            else if (hovered[i] != null) {
                setHoverMark(i, null);
            }
        };
        for (var i = 0; i < numSeries; i++) {
            _loop_1(i);
        }
        if (foundAtCursor) {
            if (foundAtCursor !== hoveredAtCursor) {
                hoveredAtCursor = foundAtCursor;
                onHover(foundAtCursor.sidx, foundAtCursor.didx, foundAtCursor);
            }
        }
        else if (hoveredAtCursor) {
            hoveredAtCursor = undefined;
            onLeave();
        }
    }
    function hoverOne(cx, cy) {
        var foundAtCursor;
        qt.get(cx, cy, 1, 1, function (o) {
            if (pointWithin(cx, cy, o.x, o.y, o.x + o.w, o.y + o.h)) {
                foundAtCursor = o;
            }
        });
        if (foundAtCursor) {
            setHoverMark(0, foundAtCursor);
            if (foundAtCursor !== hoveredAtCursor) {
                hoveredAtCursor = foundAtCursor;
                onHover(foundAtCursor.sidx, foundAtCursor.didx, foundAtCursor);
            }
        }
        else if (hoveredAtCursor) {
            setHoverMark(0, null);
            hoveredAtCursor = undefined;
            onLeave();
        }
    }
    var doHover = mode === TimelineMode.Changes ? hoverMulti : hoverOne;
    var setCursor = function (u) {
        var e_1, _a, e_2, _b;
        var cx = round(u.cursor.left * pxRatio);
        var cy = round(u.cursor.top * pxRatio);
        // if quadtree is empty, fill it
        if (!qt.o.length && qt.q == null) {
            try {
                for (var boxRectsBySeries_1 = __values(boxRectsBySeries), boxRectsBySeries_1_1 = boxRectsBySeries_1.next(); !boxRectsBySeries_1_1.done; boxRectsBySeries_1_1 = boxRectsBySeries_1.next()) {
                    var seriesRects = boxRectsBySeries_1_1.value;
                    try {
                        for (var seriesRects_1 = (e_2 = void 0, __values(seriesRects)), seriesRects_1_1 = seriesRects_1.next(); !seriesRects_1_1.done; seriesRects_1_1 = seriesRects_1.next()) {
                            var rect = seriesRects_1_1.value;
                            rect && qt.add(rect);
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (seriesRects_1_1 && !seriesRects_1_1.done && (_b = seriesRects_1.return)) _b.call(seriesRects_1);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (boxRectsBySeries_1_1 && !boxRectsBySeries_1_1.done && (_a = boxRectsBySeries_1.return)) _a.call(boxRectsBySeries_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
        doHover(cx, cy);
    };
    // hide y crosshair & hover points
    var cursor = {
        y: false,
        x: mode === TimelineMode.Changes,
        points: { show: false },
    };
    var yMids = Array(numSeries).fill(0);
    var ySplits = Array(numSeries).fill(0);
    return {
        cursor: cursor,
        xSplits: mode === TimelineMode.Samples
            ? function (u, axisIdx, scaleMin, scaleMax, foundIncr, foundSpace) {
                var splits = [];
                var dataIncr = u.data[0][1] - u.data[0][0];
                var skipFactor = ceil(foundIncr / dataIncr);
                for (var i = 0; i < u.data[0].length; i += skipFactor) {
                    var v = u.data[0][i];
                    if (v >= scaleMin && v <= scaleMax) {
                        splits.push(v);
                    }
                }
                return splits;
            }
            : null,
        xRange: function (u) {
            var r = getTimeRange();
            var min = r.from.valueOf();
            var max = r.to.valueOf();
            if (mode === TimelineMode.Samples) {
                var colWid = u.data[0][1] - u.data[0][0];
                var scalePad = colWid / 2;
                if (min <= u.data[0][0]) {
                    min = u.data[0][0] - scalePad;
                }
                var lastIdx = u.data[0].length - 1;
                if (max >= u.data[0][lastIdx]) {
                    max = u.data[0][lastIdx] + scalePad;
                }
            }
            return [min, max];
        },
        ySplits: function (u) {
            walk(rowHeight, null, numSeries, u.bbox.height, function (iy, y0, hgt) {
                // vertical midpoints of each series' timeline (stored relative to .u-over)
                yMids[iy] = round(y0 + hgt / 2);
                ySplits[iy] = u.posToVal(yMids[iy] / pxRatio, FIXED_UNIT);
            });
            return ySplits;
        },
        yValues: function (u, splits) { return splits.map(function (v, i) { return label(i + 1); }); },
        yRange: [0, 1],
        // pathbuilders
        drawPaths: drawPaths,
        drawPoints: drawPoints,
        // hooks
        init: init,
        drawClear: drawClear,
        setCursor: setCursor,
    };
}
function getFillColor(fieldConfig, color) {
    var _a;
    // if #rgba with pre-existing alpha. ignore fieldConfig.fillOpacity
    // e.g. thresholds with opacity
    if (color[0] === '#' && color.length === 9) {
        return color;
    }
    var opacityPercent = ((_a = fieldConfig.fillOpacity) !== null && _a !== void 0 ? _a : 100) / 100;
    return alpha(color, opacityPercent);
}
//# sourceMappingURL=timeline.js.map