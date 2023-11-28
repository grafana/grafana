import { isArray } from 'lodash';
import { anyToNumber, FieldColorModeId, getFieldDisplayName, MappingType, ReducerID, ThresholdsMode, FieldType, } from '@grafana/data';
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
    var _a;
    const config = {};
    const context = {};
    for (const field of frame.fields) {
        const fieldName = getFieldDisplayName(field, frame);
        const mapping = evaluatedMappings.index[fieldName];
        const handler = mapping.handler;
        if (!handler) {
            continue;
        }
        const configValue = field.values[rowIndex];
        if (configValue === null || configValue === undefined) {
            continue;
        }
        const newValue = handler.processor(configValue, config, context);
        if (newValue != null) {
            config[(_a = handler.targetProperty) !== null && _a !== void 0 ? _a : handler.key] = newValue;
        }
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
export const configMapHandlers = [
    {
        key: FieldConfigHandlerKey.Name,
        name: 'Field name',
        processor: () => { },
    },
    {
        key: FieldConfigHandlerKey.Value,
        name: 'Field value',
        processor: () => { },
    },
    {
        key: FieldConfigHandlerKey.Label,
        name: 'Field label',
        processor: () => { },
    },
    {
        key: FieldConfigHandlerKey.Ignore,
        name: 'Ignore',
        processor: () => { },
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
        processor: (value) => value.toString(),
    },
    {
        key: 'decimals',
        processor: toNumericOrUndefined,
    },
    {
        key: 'displayName',
        name: 'Display name',
        processor: (value) => value.toString(),
    },
    {
        key: 'color',
        processor: (value) => ({ fixedColor: value, mode: FieldColorModeId.Fixed }),
    },
    {
        key: 'threshold1',
        targetProperty: 'thresholds',
        processor: (value, config) => {
            const numeric = anyToNumber(value);
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
        processor: (value, config, context) => {
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
        processor: (value, config, context) => {
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
        processor: (value, config, context) => {
            if (!isArray(value)) {
                return;
            }
            context.mappingTexts = value;
            return config.mappings;
        },
    },
];
function combineValueMappings(context) {
    const valueMap = {
        type: MappingType.ValueToText,
        options: {},
    };
    if (!context.mappingValues) {
        return [];
    }
    for (let i = 0; i < context.mappingValues.length; i++) {
        const value = context.mappingValues[i];
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
let configMapHandlersIndex = null;
export function getConfigMapHandlersIndex() {
    if (configMapHandlersIndex === null) {
        configMapHandlersIndex = {};
        for (const def of configMapHandlers) {
            configMapHandlersIndex[def.key] = def;
        }
    }
    return configMapHandlersIndex;
}
function toNumericOrUndefined(value) {
    const numeric = anyToNumber(value);
    if (isNaN(numeric)) {
        return;
    }
    return numeric;
}
export function getConfigHandlerKeyForField(fieldName, mappings) {
    for (const map of mappings) {
        if (fieldName === map.fieldName) {
            return map.handlerKey;
        }
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
    var _a, _b;
    const result = {
        index: {},
    };
    // Look up name and value field in mappings
    let nameFieldMappping = mappings.find((x) => x.handlerKey === FieldConfigHandlerKey.Name);
    let valueFieldMapping = mappings.find((x) => x.handlerKey === FieldConfigHandlerKey.Value);
    for (const field of frame.fields) {
        const fieldName = getFieldDisplayName(field, frame);
        const mapping = mappings.find((x) => x.fieldName === fieldName);
        const key = mapping ? mapping.handlerKey : fieldName.toLowerCase();
        let handler = lookUpConfigHandler(key);
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
            reducerId: (_b = (_a = mapping === null || mapping === void 0 ? void 0 : mapping.reducerId) !== null && _a !== void 0 ? _a : handler === null || handler === void 0 ? void 0 : handler.defaultReducer) !== null && _b !== void 0 ? _b : ReducerID.lastNotNull,
        };
    }
    return result;
}
//# sourceMappingURL=fieldToConfigMapping.js.map