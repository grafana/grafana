import { __assign, __read, __spreadArray, __values } from "tslib";
import { map } from 'rxjs/operators';
import { FieldType, NullValueMode } from '../../types';
import { DataTransformerID } from './ids';
import { doStandardCalcs, fieldReducers, ReducerID } from '../fieldReducer';
import { getFieldMatcher } from '../matchers';
import { FieldMatcherID } from '../matchers/ids';
import { RowVector } from '../../vector/RowVector';
import { ArrayVector, BinaryOperationVector, ConstantVector } from '../../vector';
import { AsNumberVector } from '../../vector/AsNumberVector';
import { getTimeField } from '../../dataframe/processDataFrame';
import { defaults } from 'lodash';
import { BinaryOperationID, binaryOperators } from '../../utils/binaryOperators';
import { ensureColumnsTransformer } from './ensureColumns';
import { getFieldDisplayName } from '../../field';
import { noopTransformer } from './noop';
export var CalculateFieldMode;
(function (CalculateFieldMode) {
    CalculateFieldMode["ReduceRow"] = "reduceRow";
    CalculateFieldMode["BinaryOperation"] = "binary";
})(CalculateFieldMode || (CalculateFieldMode = {}));
var defaultReduceOptions = {
    reducer: ReducerID.sum,
};
var defaultBinaryOptions = {
    left: '',
    operator: BinaryOperationID.Add,
    right: '',
};
export var calculateFieldTransformer = {
    id: DataTransformerID.calculateField,
    name: 'Add field from calculation',
    description: 'Use the row values to calculate a new field',
    defaultOptions: {
        mode: CalculateFieldMode.ReduceRow,
        reduce: {
            reducer: ReducerID.sum,
        },
    },
    operator: function (options) { return function (outerSource) {
        var operator = options && options.timeSeries !== false ? ensureColumnsTransformer.operator(null) : noopTransformer.operator({});
        return outerSource.pipe(operator, map(function (data) {
            var _a;
            var mode = (_a = options.mode) !== null && _a !== void 0 ? _a : CalculateFieldMode.ReduceRow;
            var creator = undefined;
            if (mode === CalculateFieldMode.ReduceRow) {
                creator = getReduceRowCreator(defaults(options.reduce, defaultReduceOptions), data);
            }
            else if (mode === CalculateFieldMode.BinaryOperation) {
                creator = getBinaryCreator(defaults(options.binary, defaultBinaryOptions), data);
            }
            // Nothing configured
            if (!creator) {
                return data;
            }
            return data.map(function (frame) {
                // delegate field creation to the specific function
                var values = creator(frame);
                if (!values) {
                    return frame;
                }
                var field = {
                    name: getNameFromOptions(options),
                    type: FieldType.number,
                    config: {},
                    values: values,
                };
                var fields = [];
                // Replace all fields with the single field
                if (options.replaceFields) {
                    var timeField = getTimeField(frame).timeField;
                    if (timeField && options.timeSeries !== false) {
                        fields = [timeField, field];
                    }
                    else {
                        fields = [field];
                    }
                }
                else {
                    fields = __spreadArray(__spreadArray([], __read(frame.fields), false), [field], false);
                }
                return __assign(__assign({}, frame), { fields: fields });
            });
        }));
    }; },
};
function getReduceRowCreator(options, allFrames) {
    var _a;
    var matcher = getFieldMatcher({
        id: FieldMatcherID.numeric,
    });
    if (options.include && options.include.length) {
        matcher = getFieldMatcher({
            id: FieldMatcherID.byNames,
            options: {
                names: options.include,
            },
        });
    }
    var info = fieldReducers.get(options.reducer);
    if (!info) {
        throw new Error("Unknown reducer: " + options.reducer);
    }
    var reducer = (_a = info.reduce) !== null && _a !== void 0 ? _a : doStandardCalcs;
    var ignoreNulls = options.nullValueMode === NullValueMode.Ignore;
    var nullAsZero = options.nullValueMode === NullValueMode.AsZero;
    return function (frame) {
        var e_1, _a;
        // Find the columns that should be examined
        var columns = [];
        try {
            for (var _b = __values(frame.fields), _c = _b.next(); !_c.done; _c = _b.next()) {
                var field = _c.value;
                if (matcher(field, frame, allFrames)) {
                    columns.push(field.values);
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
        // Prepare a "fake" field for the row
        var iter = new RowVector(columns);
        var row = {
            name: 'temp',
            values: iter,
            type: FieldType.number,
            config: {},
        };
        var vals = [];
        for (var i = 0; i < frame.length; i++) {
            iter.rowIndex = i;
            var val = reducer(row, ignoreNulls, nullAsZero)[options.reducer];
            vals.push(val);
        }
        return new ArrayVector(vals);
    };
}
function findFieldValuesWithNameOrConstant(frame, name, allFrames) {
    var e_2, _a;
    if (!name) {
        return undefined;
    }
    try {
        for (var _b = __values(frame.fields), _c = _b.next(); !_c.done; _c = _b.next()) {
            var f = _c.value;
            if (name === getFieldDisplayName(f, frame, allFrames)) {
                if (f.type === FieldType.boolean) {
                    return new AsNumberVector(f.values);
                }
                return f.values;
            }
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_2) throw e_2.error; }
    }
    var v = parseFloat(name);
    if (!isNaN(v)) {
        return new ConstantVector(v, frame.length);
    }
    return undefined;
}
function getBinaryCreator(options, allFrames) {
    var operator = binaryOperators.getIfExists(options.operator);
    return function (frame) {
        var left = findFieldValuesWithNameOrConstant(frame, options.left, allFrames);
        var right = findFieldValuesWithNameOrConstant(frame, options.right, allFrames);
        if (!left || !right || !operator) {
            return undefined;
        }
        return new BinaryOperationVector(left, right, operator.operation);
    };
}
export function getNameFromOptions(options) {
    var _a, _b, _c, _d, _e;
    if ((_a = options.alias) === null || _a === void 0 ? void 0 : _a.length) {
        return options.alias;
    }
    if (options.mode === CalculateFieldMode.BinaryOperation) {
        var binary = options.binary;
        return ((_b = binary === null || binary === void 0 ? void 0 : binary.left) !== null && _b !== void 0 ? _b : '') + " " + ((_c = binary === null || binary === void 0 ? void 0 : binary.operator) !== null && _c !== void 0 ? _c : '') + " " + ((_d = binary === null || binary === void 0 ? void 0 : binary.right) !== null && _d !== void 0 ? _d : '');
    }
    if (options.mode === CalculateFieldMode.ReduceRow) {
        var r = fieldReducers.getIfExists((_e = options.reduce) === null || _e === void 0 ? void 0 : _e.reducer);
        if (r) {
            return r.name;
        }
    }
    return 'math';
}
//# sourceMappingURL=calculateField.js.map