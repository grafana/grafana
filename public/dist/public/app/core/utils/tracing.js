import { __read, __spreadArray, __values } from "tslib";
/**
 * Get non overlapping duration of the ranges as they can overlap or have gaps.
 */
import { FieldType, MutableDataFrame, NodeGraphDataFrameFieldNames as Fields } from '@grafana/data';
export function getNonOverlappingDuration(ranges) {
    ranges.sort(function (a, b) { return a[0] - b[0]; });
    var mergedRanges = ranges.reduce(function (acc, range) {
        if (!acc.length) {
            return [range];
        }
        var tail = acc.slice(-1)[0];
        var _a = __read(tail, 2), prevStart = _a[0], prevEnd = _a[1];
        var _b = __read(range, 2), start = _b[0], end = _b[1];
        if (end < prevEnd) {
            // In this case the range is completely inside the prev range so we can just ignore it.
            return acc;
        }
        if (start > prevEnd) {
            // There is no overlap so we can just add it to stack
            return __spreadArray(__spreadArray([], __read(acc), false), [range], false);
        }
        // We know there is overlap and current range ends later than previous so we can just extend the range
        return __spreadArray(__spreadArray([], __read(acc.slice(0, -1)), false), [[prevStart, end]], false);
    }, []);
    return mergedRanges.reduce(function (acc, range) {
        return acc + (range[1] - range[0]);
    }, 0);
}
/**
 * Returns a map of the spans with children array for easier processing. It will also contain empty spans in case
 * span is missing but other spans are it's children. This is more generic because it needs to allow iterating over
 * both arrays and dataframe views.
 */
export function makeSpanMap(getSpan) {
    var e_1, _a;
    var spanMap = {};
    var span;
    for (var index = 0; (span = getSpan(index)), !!span; index++) {
        if (!spanMap[span.id]) {
            spanMap[span.id] = {
                span: span.span,
                children: [],
            };
        }
        else {
            spanMap[span.id].span = span.span;
        }
        try {
            for (var _b = (e_1 = void 0, __values(span.parentIds)), _c = _b.next(); !_c.done; _c = _b.next()) {
                var parentId = _c.value;
                if (parentId) {
                    if (!spanMap[parentId]) {
                        spanMap[parentId] = {
                            span: undefined,
                            children: [span.id],
                        };
                    }
                    else {
                        spanMap[parentId].children.push(span.id);
                    }
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
    }
    return spanMap;
}
export function getStats(duration, traceDuration, selfDuration) {
    return {
        main: toFixedNoTrailingZeros(duration) + "ms (" + toFixedNoTrailingZeros((duration / traceDuration) * 100) + "%)",
        secondary: toFixedNoTrailingZeros(selfDuration) + "ms (" + toFixedNoTrailingZeros((selfDuration / duration) * 100) + "%)",
    };
}
function toFixedNoTrailingZeros(n) {
    return parseFloat(n.toFixed(2));
}
/**
 * Create default frames used when returning data for node graph.
 */
export function makeFrames() {
    var nodesFrame = new MutableDataFrame({
        fields: [
            { name: Fields.id, type: FieldType.string },
            { name: Fields.title, type: FieldType.string },
            { name: Fields.subTitle, type: FieldType.string },
            { name: Fields.mainStat, type: FieldType.string, config: { displayName: 'Total time (% of trace)' } },
            { name: Fields.secondaryStat, type: FieldType.string, config: { displayName: 'Self time (% of total)' } },
            {
                name: Fields.color,
                type: FieldType.number,
                config: { color: { mode: 'continuous-GrYlRd' }, displayName: 'Self time / Trace duration' },
            },
        ],
        meta: {
            preferredVisualisationType: 'nodeGraph',
        },
    });
    var edgesFrame = new MutableDataFrame({
        fields: [
            { name: Fields.id, type: FieldType.string },
            { name: Fields.target, type: FieldType.string },
            { name: Fields.source, type: FieldType.string },
        ],
        meta: {
            preferredVisualisationType: 'nodeGraph',
        },
    });
    return [nodesFrame, edgesFrame];
}
//# sourceMappingURL=tracing.js.map