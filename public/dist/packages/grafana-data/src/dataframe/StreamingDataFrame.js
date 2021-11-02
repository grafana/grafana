import { __assign, __read, __values } from "tslib";
import { FieldType } from '../types';
import { ArrayVector } from '../vector';
import { decodeFieldValueEntities } from './DataFrameJSON';
import { guessFieldTypeFromValue } from './processDataFrame';
import { join } from '../transformations/transformers/joinDataFrames';
/**
 * Indicate if the frame is appened or replace
 *
 * @public -- but runtime
 */
export var StreamingFrameAction;
(function (StreamingFrameAction) {
    StreamingFrameAction["Append"] = "append";
    StreamingFrameAction["Replace"] = "replace";
})(StreamingFrameAction || (StreamingFrameAction = {}));
var PushMode;
(function (PushMode) {
    PushMode[PushMode["wide"] = 0] = "wide";
    PushMode[PushMode["labels"] = 1] = "labels";
    // long
})(PushMode || (PushMode = {}));
/**
 * Unlike a circular buffer, this will append and periodically slice the front
 *
 * @alpha
 */
var StreamingDataFrame = /** @class */ (function () {
    function StreamingDataFrame(frame, opts) {
        this.meta = {};
        this.fields = [];
        this.length = 0;
        this.schemaFields = [];
        this.timeFieldIndex = -1;
        this.pushMode = PushMode.wide;
        this.alwaysReplace = false;
        // current labels
        this.labels = new Set();
        this.packetInfo = {
            number: 0,
            action: StreamingFrameAction.Replace,
            length: 0,
        };
        this.options = __assign({ maxLength: 1000, maxDelta: Infinity }, opts);
        this.alwaysReplace = this.options.action === StreamingFrameAction.Replace;
        this.push(frame);
    }
    /**
     * apply the new message to the existing data.  This will replace the existing schema
     * if a new schema is included in the message, or append data matching the current schema
     */
    StreamingDataFrame.prototype.push = function (msg) {
        var e_1, _a;
        var _this = this;
        var schema = msg.schema, data = msg.data;
        this.packetInfo.number++;
        if (schema) {
            this.pushMode = PushMode.wide;
            this.timeFieldIndex = schema.fields.findIndex(function (f) { return f.type === FieldType.time; });
            if (this.timeFieldIndex === 1 &&
                schema.fields[0].name === 'labels' &&
                schema.fields[0].type === FieldType.string) {
                this.pushMode = PushMode.labels;
                this.timeFieldIndex = 0; // after labels are removed!
            }
            var niceSchemaFields_1 = this.pushMode === PushMode.labels ? schema.fields.slice(1) : schema.fields;
            this.refId = schema.refId;
            if (schema.meta) {
                this.meta = __assign({}, schema.meta);
            }
            if (hasSameStructure(this.schemaFields, niceSchemaFields_1)) {
                var len_1 = niceSchemaFields_1.length;
                this.fields.forEach(function (f, idx) {
                    var _a;
                    var sf = niceSchemaFields_1[idx % len_1];
                    f.config = (_a = sf.config) !== null && _a !== void 0 ? _a : {};
                    f.labels = sf.labels;
                });
            }
            else {
                var isWide_1 = this.pushMode === PushMode.wide;
                this.fields = niceSchemaFields_1.map(function (f) {
                    var _a, _b, _c, _d;
                    return {
                        config: (_a = f.config) !== null && _a !== void 0 ? _a : {},
                        name: f.name,
                        labels: f.labels,
                        type: (_b = f.type) !== null && _b !== void 0 ? _b : FieldType.other,
                        // transfer old values by type & name, unless we relied on labels to match fields
                        values: isWide_1
                            ? (_d = (_c = _this.fields.find(function (of) { return of.name === f.name && f.type === of.type; })) === null || _c === void 0 ? void 0 : _c.values) !== null && _d !== void 0 ? _d : new ArrayVector()
                            : new ArrayVector(),
                    };
                });
            }
            this.schemaFields = niceSchemaFields_1;
        }
        if (data && data.values.length && data.values[0].length) {
            var values_1 = data.values, entities = data.entities;
            if (entities) {
                entities.forEach(function (ents, i) {
                    if (ents) {
                        decodeFieldValueEntities(ents, values_1[i]);
                        // TODO: append replacements to field
                    }
                });
            }
            if (this.pushMode === PushMode.labels) {
                // augment and transform data to match current schema for standard circPush() path
                var labeledTables_1 = transpose(values_1);
                try {
                    // make sure fields are initalized for each label
                    for (var _b = __values(labeledTables_1.keys()), _c = _b.next(); !_c.done; _c = _b.next()) {
                        var label = _c.value;
                        if (!this.labels.has(label)) {
                            this.addLabel(label);
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
                // TODO: cache higher up
                var dummyTable_1 = Array(this.schemaFields.length).fill([]);
                var tables_1 = [];
                this.labels.forEach(function (label) {
                    var _a;
                    tables_1.push((_a = labeledTables_1.get(label)) !== null && _a !== void 0 ? _a : dummyTable_1);
                });
                values_1 = join(tables_1);
            }
            if (values_1.length !== this.fields.length) {
                if (this.fields.length) {
                    throw new Error("push message mismatch.  Expected: " + this.fields.length + ", recieved: " + values_1.length + " (labels=" + (this.pushMode === PushMode.labels) + ")");
                }
                this.fields = values_1.map(function (vals, idx) {
                    var name = "Field " + idx;
                    var type = guessFieldTypeFromValue(vals[0]);
                    var isTime = idx === 0 && type === FieldType.number && vals[0] > 1600016688632;
                    if (isTime) {
                        type = FieldType.time;
                        name = 'Time';
                    }
                    return {
                        name: name,
                        type: type,
                        config: {},
                        values: new ArrayVector([]),
                    };
                });
            }
            var appended = values_1;
            this.packetInfo.length = values_1[0].length;
            if (this.alwaysReplace || !this.length) {
                this.packetInfo.action = StreamingFrameAction.Replace;
            }
            else {
                this.packetInfo.action = StreamingFrameAction.Append;
                // mutates appended
                appended = this.fields.map(function (f) { return f.values.buffer; });
                circPush(appended, values_1, this.options.maxLength, this.timeFieldIndex, this.options.maxDelta);
            }
            appended.forEach(function (v, i) {
                var _a = _this.fields[i], state = _a.state, values = _a.values;
                values.buffer = v;
                if (state) {
                    state.calcs = undefined;
                }
            });
            // Update the frame length
            this.length = appended[0].length;
        }
    };
    // adds a set of fields for a new label
    StreamingDataFrame.prototype.addLabel = function (label) {
        var _a;
        var labelCount = this.labels.size;
        // parse labels
        var parsedLabels = {};
        if (label.length) {
            label.split(',').forEach(function (kv) {
                var _a = __read(kv.trim().split('='), 2), key = _a[0], val = _a[1];
                parsedLabels[key] = val;
            });
        }
        if (labelCount === 0) {
            // mutate existing fields and add labels
            this.fields.forEach(function (f, i) {
                if (i > 0) {
                    f.labels = parsedLabels;
                }
            });
        }
        else {
            for (var i = 1; i < this.schemaFields.length; i++) {
                var proto = this.schemaFields[i];
                this.fields.push(__assign(__assign({}, proto), { config: (_a = proto.config) !== null && _a !== void 0 ? _a : {}, labels: parsedLabels, values: new ArrayVector(Array(this.length).fill(undefined)) }));
            }
        }
        this.labels.add(label);
    };
    return StreamingDataFrame;
}());
export { StreamingDataFrame };
// converts vertical insertion records with table keys in [0] and column values in [1...N]
// to join()-able tables with column arrays
export function transpose(vrecs) {
    var tableKeys = new Set(vrecs[0]);
    var tables = new Map();
    tableKeys.forEach(function (key) {
        var cols = Array(vrecs.length - 1)
            .fill(null)
            .map(function () { return []; });
        tables.set(key, cols);
    });
    for (var r = 0; r < vrecs[0].length; r++) {
        var table = tables.get(vrecs[0][r]);
        for (var c = 1; c < vrecs.length; c++) {
            table[c - 1].push(vrecs[c][r]);
        }
    }
    return tables;
}
// binary search for index of closest value
function closestIdx(num, arr, lo, hi) {
    var mid;
    lo = lo || 0;
    hi = hi || arr.length - 1;
    var bitwise = hi <= 2147483647;
    while (hi - lo > 1) {
        mid = bitwise ? (lo + hi) >> 1 : Math.floor((lo + hi) / 2);
        if (arr[mid] < num) {
            lo = mid;
        }
        else {
            hi = mid;
        }
    }
    if (num - arr[lo] <= arr[hi] - num) {
        return lo;
    }
    return hi;
}
/**
 * @internal // not exported in yet
 */
export function getLastStreamingDataFramePacket(frame) {
    var pi = frame.packetInfo;
    return (pi === null || pi === void 0 ? void 0 : pi.action) ? pi : undefined;
}
// mutable circular push
function circPush(data, newData, maxLength, deltaIdx, maxDelta) {
    if (maxLength === void 0) { maxLength = Infinity; }
    if (deltaIdx === void 0) { deltaIdx = 0; }
    if (maxDelta === void 0) { maxDelta = Infinity; }
    for (var i = 0; i < data.length; i++) {
        data[i] = data[i].concat(newData[i]);
    }
    var nlen = data[0].length;
    var sliceIdx = 0;
    if (nlen > maxLength) {
        sliceIdx = nlen - maxLength;
    }
    if (maxDelta !== Infinity && deltaIdx >= 0) {
        var deltaLookup = data[deltaIdx];
        var low = deltaLookup[sliceIdx];
        var high = deltaLookup[nlen - 1];
        if (high - low > maxDelta) {
            sliceIdx = closestIdx(high - maxDelta, deltaLookup, sliceIdx);
        }
    }
    if (sliceIdx) {
        for (var i = 0; i < data.length; i++) {
            data[i] = data[i].slice(sliceIdx);
        }
    }
    return sliceIdx;
}
function hasSameStructure(a, b) {
    if ((a === null || a === void 0 ? void 0 : a.length) !== b.length) {
        return false;
    }
    for (var i = 0; i < a.length; i++) {
        var fA = a[i];
        var fB = b[i];
        if (fA.name !== fB.name || fA.type !== fB.type) {
            return false;
        }
    }
    return true;
}
//# sourceMappingURL=StreamingDataFrame.js.map