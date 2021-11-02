import { __read, __values } from "tslib";
import { ensureTimeField, FieldType } from '@grafana/data';
import { StackingMode } from '@grafana/schema';
import { orderBy } from 'lodash';
import { attachDebugger } from '../../utils';
import { createLogger } from '../../utils/logger';
var ALLOWED_FORMAT_STRINGS_REGEX = /\b(YYYY|YY|MMMM|MMM|MM|M|DD|D|WWWW|WWW|HH|H|h|AA|aa|a|mm|m|ss|s|fff)\b/g;
export function timeFormatToTemplate(f) {
    return f.replace(ALLOWED_FORMAT_STRINGS_REGEX, function (match) { return "{" + match + "}"; });
}
var paddingSide = function (u, side, sidesWithAxes) {
    var hasCrossAxis = side % 2 ? sidesWithAxes[0] || sidesWithAxes[2] : sidesWithAxes[1] || sidesWithAxes[3];
    return sidesWithAxes[side] || !hasCrossAxis ? 0 : 8;
};
export var DEFAULT_PLOT_CONFIG = {
    focus: {
        alpha: 1,
    },
    cursor: {
        focus: {
            prox: 30,
        },
    },
    legend: {
        show: false,
    },
    padding: [paddingSide, paddingSide, paddingSide, paddingSide],
    series: [],
    hooks: {},
};
/** @internal */
export function preparePlotData(frames, onStackMeta, legend) {
    var e_1, _a;
    var _b, _c;
    var frame = frames[0];
    var result = [];
    var stackingGroups = new Map();
    var seriesIndex = 0;
    for (var i = 0; i < frame.fields.length; i++) {
        var f = frame.fields[i];
        if (f.type === FieldType.time) {
            result.push(ensureTimeField(f).values.toArray());
            seriesIndex++;
            continue;
        }
        collectStackingGroups(f, stackingGroups, seriesIndex);
        result.push(f.values.toArray());
        seriesIndex++;
    }
    // Stacking
    if (stackingGroups.size !== 0) {
        var byPct = ((_c = (_b = frame.fields[1].config.custom) === null || _b === void 0 ? void 0 : _b.stacking) === null || _c === void 0 ? void 0 : _c.mode) === StackingMode.Percent;
        var dataLength = result[0].length;
        var alignedTotals = Array(stackingGroups.size);
        alignedTotals[0] = null;
        try {
            // array or stacking groups
            for (var _d = __values(stackingGroups.entries()), _e = _d.next(); !_e.done; _e = _d.next()) {
                var _f = __read(_e.value, 2), _1 = _f[0], seriesIds = _f[1];
                var seriesIdxs = orderIdsByCalcs({ ids: seriesIds, legend: legend, frame: frame });
                var groupTotals = byPct ? Array(dataLength).fill(0) : null;
                if (byPct) {
                    for (var j = 0; j < seriesIdxs.length; j++) {
                        var currentlyStacking = result[seriesIdxs[j]];
                        for (var k = 0; k < dataLength; k++) {
                            var v = currentlyStacking[k];
                            groupTotals[k] += v == null ? 0 : +v;
                        }
                    }
                }
                var acc = Array(dataLength).fill(0);
                for (var j = 0; j < seriesIdxs.length; j++) {
                    var seriesIdx = seriesIdxs[j];
                    alignedTotals[seriesIdx] = groupTotals;
                    var currentlyStacking = result[seriesIdx];
                    for (var k = 0; k < dataLength; k++) {
                        var v = currentlyStacking[k];
                        acc[k] += v == null ? 0 : v / (byPct ? groupTotals[k] : 1);
                    }
                    result[seriesIdx] = acc.slice();
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_e && !_e.done && (_a = _d.return)) _a.call(_d);
            }
            finally { if (e_1) throw e_1.error; }
        }
        onStackMeta &&
            onStackMeta({
                totals: alignedTotals,
            });
    }
    return result;
}
export function collectStackingGroups(f, groups, seriesIdx) {
    var _a, _b, _c;
    var customConfig = f.config.custom;
    if (!customConfig) {
        return;
    }
    if (((_a = customConfig.stacking) === null || _a === void 0 ? void 0 : _a.mode) !== StackingMode.None &&
        ((_b = customConfig.stacking) === null || _b === void 0 ? void 0 : _b.group) &&
        !((_c = customConfig.hideFrom) === null || _c === void 0 ? void 0 : _c.viz)) {
        if (!groups.has(customConfig.stacking.group)) {
            groups.set(customConfig.stacking.group, [seriesIdx]);
        }
        else {
            groups.set(customConfig.stacking.group, groups.get(customConfig.stacking.group).concat(seriesIdx));
        }
    }
}
/**
 * Finds y axis midpoind for point at given idx (css pixels relative to uPlot canvas)
 * @internal
 **/
export function findMidPointYPosition(u, idx) {
    var y;
    var sMaxIdx = 1;
    var sMinIdx = 1;
    // assume min/max being values of 1st series
    var max = u.data[1][idx];
    var min = u.data[1][idx];
    // find min max values AND ids of the corresponding series to get the scales
    for (var i = 1; i < u.data.length; i++) {
        var sData = u.data[i];
        var sVal = sData[idx];
        if (sVal != null) {
            if (max == null) {
                max = sVal;
            }
            else {
                if (sVal > max) {
                    max = u.data[i][idx];
                    sMaxIdx = i;
                }
            }
            if (min == null) {
                min = sVal;
            }
            else {
                if (sVal < min) {
                    min = u.data[i][idx];
                    sMinIdx = i;
                }
            }
        }
    }
    if (min == null && max == null) {
        // no tooltip to show
        y = undefined;
    }
    else if (min != null && max != null) {
        // find median position
        y = (u.valToPos(min, u.series[sMinIdx].scale) + u.valToPos(max, u.series[sMaxIdx].scale)) / 2;
    }
    else {
        // snap tooltip to min OR max point, one of thos is not null :)
        y = u.valToPos((min || max), u.series[(sMaxIdx || sMinIdx)].scale);
    }
    return y;
}
// Dev helpers
/** @internal */
export var pluginLogger = createLogger('uPlot');
export var pluginLog = pluginLogger.logger;
// pluginLogger.enable();
attachDebugger('graphng', undefined, pluginLogger);
export function orderIdsByCalcs(_a) {
    var legend = _a.legend, ids = _a.ids, frame = _a.frame;
    if (!(legend === null || legend === void 0 ? void 0 : legend.sortBy) || legend.sortDesc == null) {
        return ids;
    }
    var orderedIds = orderBy(ids, function (id) {
        var _a, _b;
        return (_b = (_a = frame.fields[id].state) === null || _a === void 0 ? void 0 : _a.calcs) === null || _b === void 0 ? void 0 : _b[legend.sortBy.toLowerCase()];
    }, legend.sortDesc ? 'desc' : 'asc');
    return orderedIds;
}
//# sourceMappingURL=utils.js.map