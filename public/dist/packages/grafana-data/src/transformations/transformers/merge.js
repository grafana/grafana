import { __assign, __values } from "tslib";
import { map } from 'rxjs/operators';
import { DataTransformerID } from './ids';
import { omit } from 'lodash';
import { ArrayVector } from '../../vector/ArrayVector';
import { MutableDataFrame } from '../../dataframe';
export var mergeTransformer = {
    id: DataTransformerID.merge,
    name: 'Merge series/tables',
    description: 'Merges multiple series/tables into a single serie/table',
    defaultOptions: {},
    operator: function (options) { return function (source) {
        return source.pipe(map(function (dataFrames) {
            var e_1, _a;
            if (!Array.isArray(dataFrames) || dataFrames.length <= 1) {
                return dataFrames;
            }
            var data = dataFrames.filter(function (frame) { return frame.fields.length > 0; });
            if (data.length === 0) {
                return [dataFrames[0]];
            }
            var fieldNames = new Set();
            var fieldIndexByName = {};
            var fieldNamesForKey = [];
            var dataFrame = new MutableDataFrame();
            for (var frameIndex = 0; frameIndex < data.length; frameIndex++) {
                var frame = data[frameIndex];
                for (var fieldIndex = 0; fieldIndex < frame.fields.length; fieldIndex++) {
                    var field = frame.fields[fieldIndex];
                    if (!fieldNames.has(field.name)) {
                        dataFrame.addField(copyFieldStructure(field));
                        fieldNames.add(field.name);
                    }
                    fieldIndexByName[field.name] = fieldIndexByName[field.name] || {};
                    fieldIndexByName[field.name][frameIndex] = fieldIndex;
                    if (data.length - 1 !== frameIndex) {
                        continue;
                    }
                    if (fieldExistsInAllFrames(fieldIndexByName, field, data)) {
                        fieldNamesForKey.push(field.name);
                    }
                }
            }
            if (fieldNamesForKey.length === 0) {
                return dataFrames;
            }
            var valuesByKey = {};
            var valuesInOrder = [];
            var keyFactory = createKeyFactory(data, fieldIndexByName, fieldNamesForKey);
            var valueMapper = createValueMapper(data, fieldNames, fieldIndexByName);
            for (var frameIndex = 0; frameIndex < data.length; frameIndex++) {
                var frame = data[frameIndex];
                var _loop_1 = function (valueIndex) {
                    var key = keyFactory(frameIndex, valueIndex);
                    var value = valueMapper(frameIndex, valueIndex);
                    if (!Array.isArray(valuesByKey[key])) {
                        valuesByKey[key] = [value];
                        valuesInOrder.push(createPointer(key, valuesByKey));
                        return "continue";
                    }
                    var valueWasMerged = false;
                    valuesByKey[key] = valuesByKey[key].map(function (existing) {
                        if (!isMergable(existing, value)) {
                            return existing;
                        }
                        valueWasMerged = true;
                        return __assign(__assign({}, existing), value);
                    });
                    if (!valueWasMerged) {
                        valuesByKey[key].push(value);
                        valuesInOrder.push(createPointer(key, valuesByKey));
                    }
                };
                for (var valueIndex = 0; valueIndex < frame.length; valueIndex++) {
                    _loop_1(valueIndex);
                }
            }
            try {
                for (var valuesInOrder_1 = __values(valuesInOrder), valuesInOrder_1_1 = valuesInOrder_1.next(); !valuesInOrder_1_1.done; valuesInOrder_1_1 = valuesInOrder_1.next()) {
                    var pointer = valuesInOrder_1_1.value;
                    var value = valuesByKey[pointer.key][pointer.index];
                    if (value) {
                        dataFrame.add(value);
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (valuesInOrder_1_1 && !valuesInOrder_1_1.done && (_a = valuesInOrder_1.return)) _a.call(valuesInOrder_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return [dataFrame];
        }));
    }; },
};
var copyFieldStructure = function (field) {
    return __assign(__assign({}, omit(field, ['values', 'state', 'labels', 'config'])), { values: new ArrayVector(), config: __assign({}, omit(field.config, 'displayName')) });
};
var createKeyFactory = function (data, fieldPointerByName, keyFieldNames) {
    var factoryIndex = keyFieldNames.reduce(function (index, fieldName) {
        return Object.keys(fieldPointerByName[fieldName]).reduce(function (index, frameIndex) {
            index[frameIndex] = index[frameIndex] || [];
            index[frameIndex].push(fieldPointerByName[fieldName][frameIndex]);
            return index;
        }, index);
    }, {});
    return function (frameIndex, valueIndex) {
        return factoryIndex[frameIndex].reduce(function (key, fieldIndex) {
            return key + data[frameIndex].fields[fieldIndex].values.get(valueIndex);
        }, '');
    };
};
var createValueMapper = function (data, fieldByName, fieldIndexByName) {
    return function (frameIndex, valueIndex) {
        var e_2, _a;
        var value = {};
        var fieldNames = Array.from(fieldByName);
        try {
            for (var fieldNames_1 = __values(fieldNames), fieldNames_1_1 = fieldNames_1.next(); !fieldNames_1_1.done; fieldNames_1_1 = fieldNames_1.next()) {
                var fieldName = fieldNames_1_1.value;
                var fieldIndexByFrameIndex = fieldIndexByName[fieldName];
                if (!fieldIndexByFrameIndex) {
                    continue;
                }
                var fieldIndex = fieldIndexByFrameIndex[frameIndex];
                if (typeof fieldIndex !== 'number') {
                    continue;
                }
                var frame = data[frameIndex];
                if (!frame || !frame.fields) {
                    continue;
                }
                var field = frame.fields[fieldIndex];
                if (!field || !field.values) {
                    continue;
                }
                value[fieldName] = field.values.get(valueIndex);
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (fieldNames_1_1 && !fieldNames_1_1.done && (_a = fieldNames_1.return)) _a.call(fieldNames_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return value;
    };
};
var isMergable = function (existing, value) {
    var mergable = true;
    for (var prop in value) {
        if (typeof existing[prop] === 'undefined') {
            continue;
        }
        if (existing[prop] === null) {
            continue;
        }
        if (existing[prop] !== value[prop]) {
            mergable = false;
            break;
        }
    }
    return mergable;
};
var fieldExistsInAllFrames = function (fieldIndexByName, field, data) {
    return Object.keys(fieldIndexByName[field.name]).length === data.length;
};
var createPointer = function (key, valuesByKey) {
    return {
        key: key,
        index: valuesByKey[key].length - 1,
    };
};
//# sourceMappingURL=merge.js.map