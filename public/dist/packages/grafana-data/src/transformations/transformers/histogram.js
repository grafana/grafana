import { __assign, __read, __spreadArray, __values } from "tslib";
import { map } from 'rxjs/operators';
import { DataTransformerID } from './ids';
import { FieldType } from '../../types/dataFrame';
import { ArrayVector } from '../../vector/ArrayVector';
import { join } from './joinDataFrames';
import { getDisplayProcessor } from '../../field';
import { createTheme } from '../../themes';
/**
 * @internal
 */
/* eslint-disable */
// prettier-ignore
export var histogramBucketSizes = [
    1e-9, 2e-9, 2.5e-9, 4e-9, 5e-9,
    1e-8, 2e-8, 2.5e-8, 4e-8, 5e-8,
    1e-7, 2e-7, 2.5e-7, 4e-7, 5e-7,
    1e-6, 2e-6, 2.5e-6, 4e-6, 5e-6,
    1e-5, 2e-5, 2.5e-5, 4e-5, 5e-5,
    1e-4, 2e-4, 2.5e-4, 4e-4, 5e-4,
    1e-3, 2e-3, 2.5e-3, 4e-3, 5e-3,
    1e-2, 2e-2, 2.5e-2, 4e-2, 5e-2,
    1e-1, 2e-1, 2.5e-1, 4e-1, 5e-1,
    1, 2, 4, 5,
    1e+1, 2e+1, 2.5e+1, 4e+1, 5e+1,
    1e+2, 2e+2, 2.5e+2, 4e+2, 5e+2,
    1e+3, 2e+3, 2.5e+3, 4e+3, 5e+3,
    1e+4, 2e+4, 2.5e+4, 4e+4, 5e+4,
    1e+5, 2e+5, 2.5e+5, 4e+5, 5e+5,
    1e+6, 2e+6, 2.5e+6, 4e+6, 5e+6,
    1e+7, 2e+7, 2.5e+7, 4e+7, 5e+7,
    1e+8, 2e+8, 2.5e+8, 4e+8, 5e+8,
    1e+9, 2e+9, 2.5e+9, 4e+9, 5e+9,
];
/* eslint-enable */
var histFilter = [null];
var histSort = function (a, b) { return a - b; };
/**
 * This is a helper class to use the same text in both a panel and transformer UI
 *
 * @internal
 */
export var histogramFieldInfo = {
    bucketSize: {
        name: 'Bucket size',
        description: undefined,
    },
    bucketOffset: {
        name: 'Bucket offset',
        description: 'for non-zero-based buckets',
    },
    combine: {
        name: 'Combine series',
        description: 'combine all series into a single histogram',
    },
};
/**
 * @alpha
 */
export var histogramTransformer = {
    id: DataTransformerID.histogram,
    name: 'Histogram',
    description: 'Calculate a histogram from input data',
    defaultOptions: {
        fields: {},
    },
    operator: function (options) { return function (source) { return source.pipe(map(function (data) { return histogramTransformer.transformer(options)(data); })); }; },
    transformer: function (options) { return function (data) {
        if (!Array.isArray(data) || data.length === 0) {
            return data;
        }
        var hist = buildHistogram(data, options);
        if (hist == null) {
            return [];
        }
        return [histogramFieldsToFrame(hist)];
    }; },
};
/**
 * @internal
 */
export var histogramFrameBucketMinFieldName = 'BucketMin';
/**
 * @internal
 */
export var histogramFrameBucketMaxFieldName = 'BucketMax';
/**
 * Given a frame, find the explicit histogram fields
 *
 * @alpha
 */
export function getHistogramFields(frame) {
    var e_1, _a;
    var bucketMin = undefined;
    var bucketMax = undefined;
    var counts = [];
    try {
        for (var _b = __values(frame.fields), _c = _b.next(); !_c.done; _c = _b.next()) {
            var field = _c.value;
            if (field.name === histogramFrameBucketMinFieldName) {
                bucketMin = field;
            }
            else if (field.name === histogramFrameBucketMaxFieldName) {
                bucketMax = field;
            }
            else if (field.type === FieldType.number) {
                counts.push(field);
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
    if (bucketMin && bucketMax && counts.length) {
        return {
            bucketMin: bucketMin,
            bucketMax: bucketMax,
            counts: counts,
        };
    }
    return undefined;
}
var APPROX_BUCKETS = 20;
/**
 * @alpha
 */
export function buildHistogram(frames, options) {
    var e_2, _a, e_3, _b, e_4, _c, e_5, _d;
    var _e;
    var bucketSize = options === null || options === void 0 ? void 0 : options.bucketSize;
    var bucketOffset = (_e = options === null || options === void 0 ? void 0 : options.bucketOffset) !== null && _e !== void 0 ? _e : 0;
    // if bucket size is auto, try to calc from all numeric fields
    if (!bucketSize) {
        var allValues = [];
        try {
            // TODO: include field configs!
            for (var frames_1 = __values(frames), frames_1_1 = frames_1.next(); !frames_1_1.done; frames_1_1 = frames_1.next()) {
                var frame = frames_1_1.value;
                try {
                    for (var _f = (e_3 = void 0, __values(frame.fields)), _g = _f.next(); !_g.done; _g = _f.next()) {
                        var field = _g.value;
                        if (field.type === FieldType.number) {
                            allValues = allValues.concat(field.values.toArray());
                        }
                    }
                }
                catch (e_3_1) { e_3 = { error: e_3_1 }; }
                finally {
                    try {
                        if (_g && !_g.done && (_b = _f.return)) _b.call(_f);
                    }
                    finally { if (e_3) throw e_3.error; }
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (frames_1_1 && !frames_1_1.done && (_a = frames_1.return)) _a.call(frames_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
        allValues.sort(function (a, b) { return a - b; });
        var smallestDelta = Infinity;
        // TODO: case of 1 value needs work
        if (allValues.length === 1) {
            smallestDelta = 1;
        }
        else {
            for (var i = 1; i < allValues.length; i++) {
                var delta = allValues[i] - allValues[i - 1];
                if (delta !== 0) {
                    smallestDelta = Math.min(smallestDelta, delta);
                }
            }
        }
        var min = allValues[0];
        var max = allValues[allValues.length - 1];
        var range = max - min;
        var targetSize = range / APPROX_BUCKETS;
        // choose bucket
        for (var i = 0; i < histogramBucketSizes.length; i++) {
            var _bucketSize = histogramBucketSizes[i];
            if (targetSize < _bucketSize && _bucketSize >= smallestDelta) {
                bucketSize = _bucketSize;
                break;
            }
        }
    }
    var getBucket = function (v) { return incrRoundDn(v - bucketOffset, bucketSize) + bucketOffset; };
    var histograms = [];
    var counts = [];
    var config = undefined;
    try {
        for (var frames_2 = __values(frames), frames_2_1 = frames_2.next(); !frames_2_1.done; frames_2_1 = frames_2.next()) {
            var frame = frames_2_1.value;
            try {
                for (var _h = (e_5 = void 0, __values(frame.fields)), _j = _h.next(); !_j.done; _j = _h.next()) {
                    var field = _j.value;
                    if (field.type === FieldType.number) {
                        var fieldHist = histogram(field.values.toArray(), getBucket, histFilter, histSort);
                        histograms.push(fieldHist);
                        counts.push(__assign(__assign({}, field), { config: __assign(__assign({}, field.config), { unit: undefined }) }));
                        if (!config && field.config.unit) {
                            config = field.config;
                        }
                    }
                }
            }
            catch (e_5_1) { e_5 = { error: e_5_1 }; }
            finally {
                try {
                    if (_j && !_j.done && (_d = _h.return)) _d.call(_h);
                }
                finally { if (e_5) throw e_5.error; }
            }
        }
    }
    catch (e_4_1) { e_4 = { error: e_4_1 }; }
    finally {
        try {
            if (frames_2_1 && !frames_2_1.done && (_c = frames_2.return)) _c.call(frames_2);
        }
        finally { if (e_4) throw e_4.error; }
    }
    // Quit early for empty a
    if (!counts.length) {
        return null;
    }
    // align histograms
    var joinedHists = join(histograms);
    // zero-fill all undefined values (missing buckets -> 0 counts)
    for (var histIdx = 1; histIdx < joinedHists.length; histIdx++) {
        var hist = joinedHists[histIdx];
        for (var bucketIdx = 0; bucketIdx < hist.length; bucketIdx++) {
            if (hist[bucketIdx] == null) {
                hist[bucketIdx] = 0;
            }
        }
    }
    var bucketMin = {
        name: histogramFrameBucketMinFieldName,
        values: new ArrayVector(joinedHists[0]),
        type: FieldType.number,
        state: undefined,
        config: config !== null && config !== void 0 ? config : {},
    };
    var bucketMax = __assign(__assign({}, bucketMin), { name: histogramFrameBucketMaxFieldName, values: new ArrayVector(joinedHists[0].map(function (v) { return v + bucketSize; })) });
    if (options === null || options === void 0 ? void 0 : options.combine) {
        var vals = new Array(joinedHists[0].length).fill(0);
        for (var i = 1; i < joinedHists.length; i++) {
            for (var j = 0; j < vals.length; j++) {
                vals[j] += joinedHists[i][j];
            }
        }
        counts = [
            __assign(__assign({}, counts[0]), { name: 'Count', values: new ArrayVector(vals), type: FieldType.number, state: undefined }),
        ];
    }
    else {
        counts.forEach(function (field, i) {
            field.values = new ArrayVector(joinedHists[i + 1]);
        });
    }
    return {
        bucketMin: bucketMin,
        bucketMax: bucketMax,
        counts: counts,
    };
}
// function incrRound(num: number, incr: number) {
//   return Math.round(num / incr) * incr;
// }
// function incrRoundUp(num: number, incr: number) {
//   return Math.ceil(num / incr) * incr;
// }
function incrRoundDn(num, incr) {
    return Math.floor(num / incr) * incr;
}
function histogram(vals, getBucket, filterOut, sort) {
    var hist = new Map();
    for (var i = 0; i < vals.length; i++) {
        var v = vals[i];
        if (v != null) {
            v = getBucket(v);
        }
        var entry = hist.get(v);
        if (entry) {
            entry.count++;
        }
        else {
            hist.set(v, { value: v, count: 1 });
        }
    }
    filterOut && filterOut.forEach(function (v) { return hist.delete(v); });
    var bins = __spreadArray([], __read(hist.values()), false);
    sort && bins.sort(function (a, b) { return sort(a.value, b.value); });
    var values = Array(bins.length);
    var counts = Array(bins.length);
    for (var i = 0; i < bins.length; i++) {
        values[i] = bins[i].value;
        counts[i] = bins[i].count;
    }
    return [values, counts];
}
/**
 * @internal
 */
export function histogramFieldsToFrame(info, theme) {
    if (!info.bucketMin.display) {
        var display = getDisplayProcessor({
            field: info.bucketMin,
            theme: theme !== null && theme !== void 0 ? theme : createTheme(),
        });
        info.bucketMin.display = display;
        info.bucketMax.display = display;
    }
    return {
        fields: __spreadArray([info.bucketMin, info.bucketMax], __read(info.counts), false),
        length: info.bucketMin.values.length,
    };
}
//# sourceMappingURL=histogram.js.map