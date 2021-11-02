import { __values } from "tslib";
import { anyToNumber, FieldColorModeId, getFieldDisplayName, MappingType, ReducerID, ThresholdsMode, FieldType, } from '@grafana/data';
import { isArray } from 'lodash';
/**
 * Transforms a frame with fields to a map of field configs
 *
 * Input
 * | Unit        | Min | Max |
 * --------------------------------
 * | Temperature |  0  | 30  |
 * | Pressure    |  0  | 100 |
 *
 * Outputs
 * {
    { min: 0, max: 100 },
 * }
 */
export function getFieldConfigFromFrame(frame, rowIndex, evaluatedMappings) {
    var e_1, _a;
    var _b;
    var config = {};
    var context = {};
    try {
        for (var _c = __values(frame.fields), _d = _c.next(); !_d.done; _d = _c.next()) {
            var field = _d.value;
            var fieldName = getFieldDisplayName(field, frame);
            var mapping = evaluatedMappings.index[fieldName];
            var handler = mapping.handler;
            if (!handler) {
                continue;
            }
            var configValue = field.values.get(rowIndex);
            if (configValue === null || configValue === undefined) {
                continue;
            }
            var newValue = handler.processor(configValue, config, context);
            if (newValue != null) {
                config[(_b = handler.targetProperty) !== null && _b !== void 0 ? _b : handler.key] = newValue;
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
        }
        finally { if (e_1) throw e_1.error; }
    }
    if (context.mappingValues) {
        config.mappings = combineValueMappings(context);
    }
    return config;
}
export var FieldConfigHandlerKey;
(function (FieldConfigHandlerKey) {
    FieldConfigHandlerKey["Name"] = "field.name";
    FieldConfigHandlerKey["Value"] = "field.value";
    FieldConfigHandlerKey["Label"] = "field.label";
    FieldConfigHandlerKey["Ignore"] = "__ignore";
})(FieldConfigHandlerKey || (FieldConfigHandlerKey = {}));
export var configMapHandlers = [
    {
        key: FieldConfigHandlerKey.Name,
        name: 'Field name',
        processor: function () { },
    },
    {
        key: FieldConfigHandlerKey.Value,
        name: 'Field value',
        processor: function () { },
    },
    {
        key: FieldConfigHandlerKey.Label,
        name: 'Field label',
        processor: function () { },
    },
    {
        key: FieldConfigHandlerKey.Ignore,
        name: 'Ignore',
        processor: function () { },
    },
    {
        key: 'max',
        processor: toNumericOrUndefined,
    },
    {
        key: 'min',
        processor: toNumericOrUndefined,
    },
    {
        key: 'unit',
        processor: function (value) { return value.toString(); },
    },
    {
        key: 'decimals',
        processor: toNumericOrUndefined,
    },
    {
        key: 'displayName',
        name: 'Display name',
        processor: function (value) { return value.toString(); },
    },
    {
        key: 'color',
        processor: function (value) { return ({ fixedColor: value, mode: FieldColorModeId.Fixed }); },
    },
    {
        key: 'threshold1',
        targetProperty: 'thresholds',
        processor: function (value, config) {
            var numeric = anyToNumber(value);
            if (isNaN(numeric)) {
                return;
            }
            if (!config.thresholds) {
                config.thresholds = {
                    mode: ThresholdsMode.Absolute,
                    steps: [{ value: -Infinity, color: 'green' }],
                };
            }
            config.thresholds.steps.push({
                value: numeric,
                color: 'red',
            });
            return config.thresholds;
        },
    },
    {
        key: 'mappings.value',
        name: 'Value mappings / Value',
        targetProperty: 'mappings',
        defaultReducer: ReducerID.allValues,
        processor: function (value, config, context) {
            if (!isArray(value)) {
                return;
            }
            context.mappingValues = value;
            return config.mappings;
        },
    },
    {
        key: 'mappings.color',
        name: 'Value mappings / Color',
        targetProperty: 'mappings',
        defaultReducer: ReducerID.allValues,
        processor: function (value, config, context) {
            if (!isArray(value)) {
                return;
            }
            context.mappingColors = value;
            return config.mappings;
        },
    },
    {
        key: 'mappings.text',
        name: 'Value mappings / Display text',
        targetProperty: 'mappings',
        defaultReducer: ReducerID.allValues,
        processor: function (value, config, context) {
            if (!isArray(value)) {
                return;
            }
            context.mappingTexts = value;
            return config.mappings;
        },
    },
];
function combineValueMappings(context) {
    var valueMap = {
        type: MappingType.ValueToText,
        options: {},
    };
    if (!context.mappingValues) {
        return [];
    }
    for (var i = 0; i < context.mappingValues.length; i++) {
        var value = context.mappingValues[i];
        if (value != null) {
            valueMap.options[value.toString()] = {
                color: context.mappingColors && context.mappingColors[i],
                text: context.mappingTexts && context.mappingTexts[i],
                index: i,
            };
        }
    }
    return [valueMap];
}
var configMapHandlersIndex = null;
export function getConfigMapHandlersIndex() {
    var e_2, _a;
    if (configMapHandlersIndex === null) {
        configMapHandlersIndex = {};
        try {
            for (var configMapHandlers_1 = __values(configMapHandlers), configMapHandlers_1_1 = configMapHandlers_1.next(); !configMapHandlers_1_1.done; configMapHandlers_1_1 = configMapHandlers_1.next()) {
                var def = configMapHandlers_1_1.value;
                configMapHandlersIndex[def.key] = def;
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (configMapHandlers_1_1 && !configMapHandlers_1_1.done && (_a = configMapHandlers_1.return)) _a.call(configMapHandlers_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
    }
    return configMapHandlersIndex;
}
function toNumericOrUndefined(value) {
    var numeric = anyToNumber(value);
    if (isNaN(numeric)) {
        return;
    }
    return numeric;
}
export function getConfigHandlerKeyForField(fieldName, mappings) {
    var e_3, _a;
    try {
        for (var mappings_1 = __values(mappings), mappings_1_1 = mappings_1.next(); !mappings_1_1.done; mappings_1_1 = mappings_1.next()) {
            var map = mappings_1_1.value;
            if (fieldName === map.fieldName) {
                return map.handlerKey;
            }
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (mappings_1_1 && !mappings_1_1.done && (_a = mappings_1.return)) _a.call(mappings_1);
        }
        finally { if (e_3) throw e_3.error; }
    }
    return fieldName.toLowerCase();
}
export function lookUpConfigHandler(key) {
    if (!key) {
        return null;
    }
    return getConfigMapHandlersIndex()[key];
}
export function evaluteFieldMappings(frame, mappings, withNameAndValue) {
    var e_4, _a;
    var _b, _c;
    var result = {
        index: {},
    };
    // Look up name and value field in mappings
    var nameFieldMappping = mappings.find(function (x) { return x.handlerKey === FieldConfigHandlerKey.Name; });
    var valueFieldMapping = mappings.find(function (x) { return x.handlerKey === FieldConfigHandlerKey.Value; });
    var _loop_1 = function (field) {
        var fieldName = getFieldDisplayName(field, frame);
        var mapping = mappings.find(function (x) { return x.fieldName === fieldName; });
        var key = mapping ? mapping.handlerKey : fieldName.toLowerCase();
        var handler = lookUpConfigHandler(key);
        // Name and value handlers are a special as their auto logic is based on first matching criteria
        if (withNameAndValue) {
            // If we have a handler it means manually specified field
            if (handler) {
                if (handler.key === FieldConfigHandlerKey.Name) {
                    result.nameField = field;
                }
                if (handler.key === FieldConfigHandlerKey.Value) {
                    result.valueField = field;
                }
            }
            else if (!mapping) {
                // We have no name field and no mapping for it, pick first string
                if (!result.nameField && !nameFieldMappping && field.type === FieldType.string) {
                    result.nameField = field;
                    handler = lookUpConfigHandler(FieldConfigHandlerKey.Name);
                }
                if (!result.valueField && !valueFieldMapping && field.type === FieldType.number) {
                    result.valueField = field;
                    handler = lookUpConfigHandler(FieldConfigHandlerKey.Value);
                }
            }
        }
        // If no handle and when in name and value mode (Rows to fields) default to labels
        if (!handler && withNameAndValue) {
            handler = lookUpConfigHandler(FieldConfigHandlerKey.Label);
        }
        result.index[fieldName] = {
            automatic: !mapping,
            handler: handler,
            reducerId: (_c = (_b = mapping === null || mapping === void 0 ? void 0 : mapping.reducerId) !== null && _b !== void 0 ? _b : handler === null || handler === void 0 ? void 0 : handler.defaultReducer) !== null && _c !== void 0 ? _c : ReducerID.lastNotNull,
        };
    };
    try {
        for (var _d = __values(frame.fields), _e = _d.next(); !_e.done; _e = _d.next()) {
            var field = _e.value;
            _loop_1(field);
        }
    }
    catch (e_4_1) { e_4 = { error: e_4_1 }; }
    finally {
        try {
            if (_e && !_e.done && (_a = _d.return)) _a.call(_d);
        }
        finally { if (e_4) throw e_4.error; }
    }
    return result;
}
//# sourceMappingURL=fieldToConfigMapping.js.map