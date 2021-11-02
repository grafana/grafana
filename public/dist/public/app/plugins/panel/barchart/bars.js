import { __read } from "tslib";
import uPlot from 'uplot';
import { pointWithin, Quadtree } from './quadtree';
import { distribute, SPACE_BETWEEN } from './distribute';
import { calculateFontSize } from '@grafana/ui';
import { StackingMode, VisibilityMode, ScaleOrientation, } from '@grafana/schema';
import { preparePlotData } from '../../../../../packages/grafana-ui/src/components/uPlot/utils';
var groupDistr = SPACE_BETWEEN;
var barDistr = SPACE_BETWEEN;
// min.max font size for value label
var VALUE_MIN_FONT_SIZE = 8;
var VALUE_MAX_FONT_SIZE = 30;
// % of width/height of the bar that value should fit in when measuring size
var BAR_FONT_SIZE_RATIO = 0.65;
// distance between label and a bar in % of bar width
var LABEL_OFFSET_FACTOR_VT = 0.1;
var LABEL_OFFSET_FACTOR_HZ = 0.15;
// max distance
var LABEL_OFFSET_MAX_VT = 5;
var LABEL_OFFSET_MAX_HZ = 10;
// text baseline middle runs through the middle of lowercase letters
// since bar values are numbers and uppercase-like, we want the middle of uppercase
// this is a cheap fudge factor that skips expensive and inconsistent cross-browser measuring
var MIDDLE_BASELINE_SHIFT = 0.1;
/**
 * @internal
 */
export function getConfig(opts, theme) {
    var _a;
    var _b;
    var xOri = opts.xOri, dir = opts.xDir, rawValue = opts.rawValue, formatValue = opts.formatValue, showValue = opts.showValue;
    var isXHorizontal = xOri === ScaleOrientation.Horizontal;
    var hasAutoValueSize = !Boolean((_b = opts.text) === null || _b === void 0 ? void 0 : _b.valueSize);
    var isStacked = opts.stacking !== StackingMode.None;
    var pctStacked = opts.stacking === StackingMode.Percent;
    var groupWidth = opts.groupWidth, barWidth = opts.barWidth;
    if (isStacked) {
        _a = __read([barWidth, groupWidth], 2), groupWidth = _a[0], barWidth = _a[1];
    }
    var qt;
    var hovered = undefined;
    var barMark = document.createElement('div');
    barMark.classList.add('bar-mark');
    barMark.style.position = 'absolute';
    barMark.style.background = 'rgba(255,255,255,0.4)';
    var xSplits = function (u) {
        var dim = isXHorizontal ? u.bbox.width : u.bbox.height;
        var _dir = dir * (isXHorizontal ? 1 : -1);
        var splits = [];
        distribute(u.data[0].length, groupWidth, groupDistr, null, function (di, leftPct, widPct) {
            var groupLftPx = (dim * leftPct) / devicePixelRatio;
            var groupWidPx = (dim * widPct) / devicePixelRatio;
            var groupCenterPx = groupLftPx + groupWidPx / 2;
            splits.push(u.posToVal(groupCenterPx, 'x'));
        });
        return _dir === 1 ? splits : splits.reverse();
    };
    var xValues = function (u) { return u.data[0].map(function (x) { return formatValue(0, x); }); };
    var distrTwo = function (groupCount, barCount) {
        var out = Array.from({ length: barCount }, function () { return ({
            offs: Array(groupCount).fill(0),
            size: Array(groupCount).fill(0),
        }); });
        distribute(groupCount, groupWidth, groupDistr, null, function (groupIdx, groupOffPct, groupDimPct) {
            distribute(barCount, barWidth, barDistr, null, function (barIdx, barOffPct, barDimPct) {
                out[barIdx].offs[groupIdx] = groupOffPct + groupDimPct * barOffPct;
                out[barIdx].size[groupIdx] = groupDimPct * barDimPct;
            });
        });
        return out;
    };
    var distrOne = function (groupCount, barCount) {
        var out = Array.from({ length: barCount }, function () { return ({
            offs: Array(groupCount).fill(0),
            size: Array(groupCount).fill(0),
        }); });
        distribute(groupCount, groupWidth, groupDistr, null, function (groupIdx, groupOffPct, groupDimPct) {
            distribute(barCount, barWidth, barDistr, null, function (barIdx, barOffPct, barDimPct) {
                out[barIdx].offs[groupIdx] = groupOffPct;
                out[barIdx].size[groupIdx] = groupDimPct;
            });
        });
        return out;
    };
    var barsPctLayout = [];
    var barRects = [];
    // minimum available space for labels between bar end and plotting area bound (in canvas pixels)
    var vSpace = Infinity;
    var hSpace = Infinity;
    var barsBuilder = uPlot.paths.bars({
        disp: {
            x0: {
                unit: 2,
                values: function (u, seriesIdx) { return barsPctLayout[seriesIdx].offs; },
            },
            size: {
                unit: 2,
                values: function (u, seriesIdx) { return barsPctLayout[seriesIdx].size; },
            },
        },
        // collect rendered bar geometry
        each: function (u, seriesIdx, dataIdx, lft, top, wid, hgt) {
            // we get back raw canvas coords (included axes & padding)
            // translate to the plotting area origin
            lft -= u.bbox.left;
            top -= u.bbox.top;
            var val = u.data[seriesIdx][dataIdx];
            // accum min space abvailable for labels
            if (isXHorizontal) {
                vSpace = Math.min(vSpace, val < 0 ? u.bbox.height - (top + hgt) : top);
                hSpace = wid;
            }
            else {
                vSpace = hgt;
                hSpace = Math.min(hSpace, val < 0 ? lft : u.bbox.width - (lft + wid));
            }
            var barRect = { x: lft, y: top, w: wid, h: hgt, sidx: seriesIdx, didx: dataIdx };
            qt.add(barRect);
            barRects.push(barRect);
        },
    });
    var init = function (u) {
        var over = u.over;
        over.style.overflow = 'hidden';
        over.appendChild(barMark);
    };
    // Build bars
    var drawClear = function (u) {
        qt = qt || new Quadtree(0, 0, u.bbox.width, u.bbox.height);
        qt.clear();
        // clear the path cache to force drawBars() to rebuild new quadtree
        u.series.forEach(function (s) {
            // @ts-ignore
            s._paths = null;
        });
        if (isStacked) {
            //barsPctLayout = [null as any].concat(distrOne(u.data.length - 1, u.data[0].length));
            barsPctLayout = [null].concat(distrOne(u.data[0].length, u.data.length - 1));
        }
        else {
            barsPctLayout = [null].concat(distrTwo(u.data[0].length, u.data.length - 1));
        }
        barRects.length = 0;
        vSpace = hSpace = Infinity;
    };
    var LABEL_OFFSET_FACTOR = isXHorizontal ? LABEL_OFFSET_FACTOR_VT : LABEL_OFFSET_FACTOR_HZ;
    var LABEL_OFFSET_MAX = isXHorizontal ? LABEL_OFFSET_MAX_VT : LABEL_OFFSET_MAX_HZ;
    // uPlot hook to draw the labels on the bar chart.
    var draw = function (u) {
        var _a, _b;
        if (showValue === VisibilityMode.Never) {
            return;
        }
        // pre-cache formatted labels
        var texts = Array(barRects.length);
        var labelOffset = LABEL_OFFSET_MAX;
        barRects.forEach(function (r, i) {
            texts[i] = formatValue(r.sidx, rawValue(r.sidx, r.didx) / (pctStacked ? alignedTotals[r.sidx][r.didx] : 1));
            labelOffset = Math.min(labelOffset, Math.round(LABEL_OFFSET_FACTOR * (isXHorizontal ? r.w : r.h)));
        });
        var fontSize = (_b = (_a = opts.text) === null || _a === void 0 ? void 0 : _a.valueSize) !== null && _b !== void 0 ? _b : VALUE_MAX_FONT_SIZE;
        if (hasAutoValueSize) {
            for (var i = 0; i < barRects.length; i++) {
                fontSize = Math.round(Math.min(fontSize, VALUE_MAX_FONT_SIZE, calculateFontSize(texts[i], hSpace * (isXHorizontal ? BAR_FONT_SIZE_RATIO : 1) - (isXHorizontal ? 0 : labelOffset), vSpace * (isXHorizontal ? 1 : BAR_FONT_SIZE_RATIO) - (isXHorizontal ? labelOffset : 0), 1)));
                if (fontSize < VALUE_MIN_FONT_SIZE && showValue !== VisibilityMode.Always) {
                    return;
                }
            }
        }
        u.ctx.save();
        u.ctx.fillStyle = theme.colors.text.primary;
        u.ctx.font = fontSize + "px " + theme.typography.fontFamily;
        var middleShift = isXHorizontal ? 0 : -Math.round(MIDDLE_BASELINE_SHIFT * fontSize);
        var curAlign, curBaseline;
        barRects.forEach(function (r, i) {
            var value = rawValue(r.sidx, r.didx);
            var text = texts[i];
            if (value != null) {
                var align = isXHorizontal ? 'center' : value < 0 ? 'right' : 'left';
                var baseline = isXHorizontal ? (value < 0 ? 'top' : 'alphabetic') : 'middle';
                if (align !== curAlign) {
                    u.ctx.textAlign = curAlign = align;
                }
                if (baseline !== curBaseline) {
                    u.ctx.textBaseline = curBaseline = baseline;
                }
                u.ctx.fillText(text, u.bbox.left + (isXHorizontal ? r.x + r.w / 2 : value < 0 ? r.x - labelOffset : r.x + r.w + labelOffset), u.bbox.top +
                    (isXHorizontal ? (value < 0 ? r.y + r.h + labelOffset : r.y - labelOffset) : r.y + r.h / 2 - middleShift));
            }
        });
        u.ctx.restore();
    };
    // handle hover interaction with quadtree probing
    var interpolateTooltip = function (updateActiveSeriesIdx, updateActiveDatapointIdx, updateTooltipPosition, u) {
        var found;
        var cx = u.cursor.left * devicePixelRatio;
        var cy = u.cursor.top * devicePixelRatio;
        qt.get(cx, cy, 1, 1, function (o) {
            if (pointWithin(cx, cy, o.x, o.y, o.x + o.w, o.y + o.h)) {
                found = o;
            }
        });
        if (found) {
            // prettier-ignore
            if (found !== hovered) {
                barMark.style.display = '';
                barMark.style.left = found.x / devicePixelRatio + 'px';
                barMark.style.top = found.y / devicePixelRatio + 'px';
                barMark.style.width = found.w / devicePixelRatio + 'px';
                barMark.style.height = found.h / devicePixelRatio + 'px';
                hovered = found;
                updateActiveSeriesIdx(hovered.sidx);
                updateActiveDatapointIdx(hovered.didx);
                updateTooltipPosition();
            }
        }
        else if (hovered !== undefined) {
            updateActiveSeriesIdx(hovered.sidx);
            updateActiveDatapointIdx(hovered.didx);
            updateTooltipPosition();
            hovered = undefined;
            barMark.style.display = 'none';
        }
        else {
            updateTooltipPosition(true);
        }
    };
    var alignedTotals = null;
    function prepData(frames) {
        alignedTotals = null;
        return preparePlotData(frames, function (_a) {
            var totals = _a.totals;
            alignedTotals = totals;
        }, opts.legend);
    }
    return {
        cursor: {
            x: false,
            y: false,
            points: { show: false },
        },
        // scale & axis opts
        xValues: xValues,
        xSplits: xSplits,
        barsBuilder: barsBuilder,
        // hooks
        init: init,
        drawClear: drawClear,
        draw: draw,
        interpolateTooltip: interpolateTooltip,
        prepData: prepData,
    };
}
//# sourceMappingURL=bars.js.map