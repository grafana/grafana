import { __assign, __values } from "tslib";
import { map } from 'rxjs/operators';
import { DataTransformerID } from './ids';
import { TIME_SERIES_VALUE_FIELD_NAME } from '../../types/dataFrame';
import { ArrayVector } from '../../vector';
export var ConcatenateFrameNameMode;
(function (ConcatenateFrameNameMode) {
    /**
     * Ignore the source frame name when moving to the destination
     */
    ConcatenateFrameNameMode["Drop"] = "drop";
    /**
     * Copy the source frame name to the destination field.  The final field will contain
     * both the frame and field name
     */
    ConcatenateFrameNameMode["FieldName"] = "field";
    /**
     * Copy the source frame name to a label on the field.  The label key is controlled
     * by frameNameLabel
     */
    ConcatenateFrameNameMode["Label"] = "label";
})(ConcatenateFrameNameMode || (ConcatenateFrameNameMode = {}));
export var concatenateTransformer = {
    id: DataTransformerID.concatenate,
    name: 'Concatenate fields',
    description: 'Combine all fields into a single frame.  Values will be appended with undefined values if not the same length.',
    defaultOptions: {
        frameNameMode: ConcatenateFrameNameMode.FieldName,
        frameNameLabel: 'frame',
    },
    operator: function (options) { return function (source) {
        return source.pipe(map(function (dataFrames) {
            if (!Array.isArray(dataFrames) || dataFrames.length < 2) {
                return dataFrames; // noop with single frame
            }
            return [concatenateFields(dataFrames, options)];
        }));
    }; },
};
/**
 * @internal only exported for tests
 */
export function concatenateFields(data, opts) {
    var e_1, _a, e_2, _b;
    var _c;
    var sameLength = true;
    var maxLength = data[0].length;
    var frameNameLabel = (_c = opts.frameNameLabel) !== null && _c !== void 0 ? _c : 'frame';
    var fields = [];
    try {
        for (var data_1 = __values(data), data_1_1 = data_1.next(); !data_1_1.done; data_1_1 = data_1.next()) {
            var frame = data_1_1.value;
            if (maxLength !== frame.length) {
                sameLength = false;
                maxLength = Math.max(maxLength, frame.length);
            }
            try {
                for (var _d = (e_2 = void 0, __values(frame.fields)), _e = _d.next(); !_e.done; _e = _d.next()) {
                    var f = _e.value;
                    var copy = __assign({}, f);
                    copy.state = undefined;
                    if (frame.name) {
                        if (opts.frameNameMode === ConcatenateFrameNameMode.Drop) {
                            // nothing -- skip the name
                        }
                        else if (opts.frameNameMode === ConcatenateFrameNameMode.Label) {
                            copy.labels = __assign({}, f.labels);
                            copy.labels[frameNameLabel] = frame.name;
                        }
                        else if (!copy.name || copy.name === TIME_SERIES_VALUE_FIELD_NAME) {
                            copy.name = frame.name;
                        }
                        else {
                            copy.name = frame.name + " \u00B7 " + f.name;
                        }
                    }
                    fields.push(copy);
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_e && !_e.done && (_b = _d.return)) _b.call(_d);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (data_1_1 && !data_1_1.done && (_a = data_1.return)) _a.call(data_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    // Make sure all fields have the same length
    if (!sameLength) {
        fields = fields.map(function (f) {
            if (f.values.length === maxLength) {
                return f;
            }
            var values = f.values.toArray();
            values.length = maxLength;
            return __assign(__assign({}, f), { values: new ArrayVector(values) });
        });
    }
    return {
        fields: fields,
        length: maxLength,
    };
}
//# sourceMappingURL=concat.js.map