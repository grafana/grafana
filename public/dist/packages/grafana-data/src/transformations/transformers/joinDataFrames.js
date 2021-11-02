import { __assign, __values } from "tslib";
import { FieldType } from '../../types';
import { ArrayVector } from '../../vector';
import { fieldMatchers } from '../matchers';
import { FieldMatcherID } from '../matchers/ids';
import { getTimeField, sortDataFrame } from '../../dataframe';
export function pickBestJoinField(data) {
    var e_1, _a;
    var timeField = getTimeField(data[0]).timeField;
    if (timeField) {
        return fieldMatchers.get(FieldMatcherID.firstTimeField).get({});
    }
    var common = [];
    try {
        for (var _b = __values(data[0].fields), _c = _b.next(); !_c.done; _c = _b.next()) {
            var f = _c.value;
            if (f.type === FieldType.number) {
                common.push(f.name);
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
    var _loop_1 = function (i) {
        var e_2, _d;
        var names = [];
        try {
            for (var _e = (e_2 = void 0, __values(data[0].fields)), _f = _e.next(); !_f.done; _f = _e.next()) {
                var f = _f.value;
                if (f.type === FieldType.number) {
                    names.push(f.name);
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_f && !_f.done && (_d = _e.return)) _d.call(_e);
            }
            finally { if (e_2) throw e_2.error; }
        }
        common = common.filter(function (v) { return !names.includes(v); });
    };
    for (var i = 1; i < data.length; i++) {
        _loop_1(i);
    }
    return fieldMatchers.get(FieldMatcherID.byName).get(common[0]);
}
function getJoinMatcher(options) {
    var _a;
    return (_a = options.joinBy) !== null && _a !== void 0 ? _a : pickBestJoinField(options.frames);
}
/**
 * This will return a single frame joined by the first matching field.  When a join field is not specified,
 * the default will use the first time field
 */
export function outerJoinDataFrames(options) {
    var e_3, _a;
    var _b, _c, _d, _e, _f;
    if (!((_b = options.frames) === null || _b === void 0 ? void 0 : _b.length)) {
        return;
    }
    if (options.frames.length === 1) {
        var frame = options.frames[0];
        var frameCopy_1 = frame;
        var joinFieldMatcher_1 = getJoinMatcher(options);
        var joinIndex_1 = frameCopy_1.fields.findIndex(function (f) { return joinFieldMatcher_1(f, frameCopy_1, options.frames); });
        if (options.keepOriginIndices) {
            frameCopy_1 = __assign(__assign({}, frame), { fields: frame.fields.map(function (f, fieldIndex) {
                    var copy = __assign({}, f);
                    var origin = {
                        frameIndex: 0,
                        fieldIndex: fieldIndex,
                    };
                    if (copy.state) {
                        copy.state.origin = origin;
                    }
                    else {
                        copy.state = { origin: origin };
                    }
                    return copy;
                }) });
            // Make sure the join field is first
            if (joinIndex_1 > 0) {
                var joinField = frameCopy_1.fields[joinIndex_1];
                var fields = frameCopy_1.fields.filter(function (f, idx) { return idx !== joinIndex_1; });
                fields.unshift(joinField);
                frameCopy_1.fields = fields;
                joinIndex_1 = 0;
            }
        }
        if (options.enforceSort) {
            if (joinIndex_1 >= 0) {
                if (!isLikelyAscendingVector(frameCopy_1.fields[joinIndex_1].values)) {
                    frameCopy_1 = sortDataFrame(frameCopy_1, joinIndex_1);
                }
            }
        }
        if (options.keep) {
            var fields = frameCopy_1.fields.filter(function (f, fieldIdx) { return fieldIdx === joinIndex_1 || options.keep(f, frameCopy_1, options.frames); });
            // mutate already copied frame
            if (frame !== frameCopy_1) {
                frameCopy_1.fields = fields;
            }
            else {
                frameCopy_1 = __assign(__assign({}, frame), { fields: fields });
            }
        }
        return frameCopy_1;
    }
    var nullModes = [];
    var allData = [];
    var originalFields = [];
    var joinFieldMatcher = getJoinMatcher(options);
    for (var frameIndex = 0; frameIndex < options.frames.length; frameIndex++) {
        var frame = options.frames[frameIndex];
        if (!frame || !((_c = frame.fields) === null || _c === void 0 ? void 0 : _c.length)) {
            continue; // skip the frame
        }
        var nullModesFrame = [NULL_REMOVE];
        var join_1 = undefined;
        var fields = [];
        for (var fieldIndex = 0; fieldIndex < frame.fields.length; fieldIndex++) {
            var field = frame.fields[fieldIndex];
            field.state = field.state || {};
            if (!join_1 && joinFieldMatcher(field, frame, options.frames)) {
                join_1 = field;
            }
            else {
                if (options.keep && !options.keep(field, frame, options.frames)) {
                    continue; // skip field
                }
                // Support the standard graph span nulls field config
                var spanNulls = (_d = field.config.custom) === null || _d === void 0 ? void 0 : _d.spanNulls;
                nullModesFrame.push(spanNulls === true ? NULL_REMOVE : spanNulls === -1 ? NULL_RETAIN : NULL_EXPAND);
                var labels = (_e = field.labels) !== null && _e !== void 0 ? _e : {};
                if (frame.name) {
                    labels = __assign(__assign({}, labels), { name: frame.name });
                }
                fields.push(__assign(__assign({}, field), { labels: labels }));
            }
            if (options.keepOriginIndices) {
                field.state.origin = {
                    frameIndex: frameIndex,
                    fieldIndex: fieldIndex,
                };
            }
        }
        if (!join_1) {
            continue; // skip the frame
        }
        if (originalFields.length === 0) {
            originalFields.push(join_1); // first join field
        }
        nullModes.push(nullModesFrame);
        var a = [join_1.values.toArray()]; //
        try {
            for (var fields_1 = (e_3 = void 0, __values(fields)), fields_1_1 = fields_1.next(); !fields_1_1.done; fields_1_1 = fields_1.next()) {
                var field = fields_1_1.value;
                a.push(field.values.toArray());
                originalFields.push(field);
                // clear field displayName state
                (_f = field.state) === null || _f === void 0 ? true : delete _f.displayName;
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (fields_1_1 && !fields_1_1.done && (_a = fields_1.return)) _a.call(fields_1);
            }
            finally { if (e_3) throw e_3.error; }
        }
        allData.push(a);
    }
    var joined = join(allData, nullModes);
    return {
        // ...options.data[0], // keep name, meta?
        length: joined[0].length,
        fields: originalFields.map(function (f, index) { return (__assign(__assign({}, f), { values: new ArrayVector(joined[index]) })); }),
    };
}
// nullModes
var NULL_REMOVE = 0; // nulls are converted to undefined (e.g. for spanGaps: true)
var NULL_RETAIN = 1; // nulls are retained, with alignment artifacts set to undefined (default)
var NULL_EXPAND = 2; // nulls are expanded to include any adjacent alignment artifacts
// sets undefined values to nulls when adjacent to existing nulls (minesweeper)
function nullExpand(yVals, nullIdxs, alignedLen) {
    for (var i = 0, xi = void 0, lastNullIdx = -1; i < nullIdxs.length; i++) {
        var nullIdx = nullIdxs[i];
        if (nullIdx > lastNullIdx) {
            xi = nullIdx - 1;
            while (xi >= 0 && yVals[xi] == null) {
                yVals[xi--] = null;
            }
            xi = nullIdx + 1;
            while (xi < alignedLen && yVals[xi] == null) {
                yVals[(lastNullIdx = xi++)] = null;
            }
        }
    }
}
// nullModes is a tables-matched array indicating how to treat nulls in each series
export function join(tables, nullModes) {
    var xVals = new Set();
    for (var ti = 0; ti < tables.length; ti++) {
        var t = tables[ti];
        var xs = t[0];
        var len = xs.length;
        for (var i = 0; i < len; i++) {
            xVals.add(xs[i]);
        }
    }
    var data = [Array.from(xVals).sort(function (a, b) { return a - b; })];
    var alignedLen = data[0].length;
    var xIdxs = new Map();
    for (var i = 0; i < alignedLen; i++) {
        xIdxs.set(data[0][i], i);
    }
    for (var ti = 0; ti < tables.length; ti++) {
        var t = tables[ti];
        var xs = t[0];
        for (var si = 1; si < t.length; si++) {
            var ys = t[si];
            var yVals = Array(alignedLen).fill(undefined);
            var nullMode = nullModes ? nullModes[ti][si] : NULL_RETAIN;
            var nullIdxs = [];
            for (var i = 0; i < ys.length; i++) {
                var yVal = ys[i];
                var alignedIdx = xIdxs.get(xs[i]);
                if (yVal === null) {
                    if (nullMode !== NULL_REMOVE) {
                        yVals[alignedIdx] = yVal;
                        if (nullMode === NULL_EXPAND) {
                            nullIdxs.push(alignedIdx);
                        }
                    }
                }
                else {
                    yVals[alignedIdx] = yVal;
                }
            }
            nullExpand(yVals, nullIdxs, alignedLen);
            data.push(yVals);
        }
    }
    return data;
}
// Quick test if the first and last points look to be ascending
// Only exported for tests
export function isLikelyAscendingVector(data) {
    var first = undefined;
    for (var idx_1 = 0; idx_1 < data.length; idx_1++) {
        var v = data.get(idx_1);
        if (v != null) {
            if (first != null) {
                if (first > v) {
                    return false; // descending
                }
                break;
            }
            first = v;
        }
    }
    var idx = data.length - 1;
    while (idx >= 0) {
        var v = data.get(idx--);
        if (v != null) {
            if (first > v) {
                return false;
            }
            return true;
        }
    }
    return true; // only one non-null point
}
//# sourceMappingURL=joinDataFrames.js.map