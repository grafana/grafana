import {
  anyToNumber,
  DataFrame,
  FieldColorModeId,
  FieldConfig,
  getFieldDisplayName,
  MappingType,
  ReducerID,
  ThresholdsMode,
  ValueMapping,
  ValueMap,
} from '@grafana/data';
import { isArray } from 'lodash';

export interface FieldToConfigMapping {
  fieldName: string;
  reducerId?: ReducerID;
  configProperty: string | null;
}

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

export function getFieldConfigFromFrame(
  frame: DataFrame,
  rowIndex: number,
  mappings: FieldToConfigMapping[]
): FieldConfig {
  const config: FieldConfig = {};
  const context: FieldToConfigContext = {};

  for (const field of frame.fields) {
    const fieldName = getFieldDisplayName(field, frame);
    const handlerKey = getConfigHandlerKeyForField(fieldName, mappings);
    const configDef = lookUpConfigHandler(handlerKey);

    if (!configDef) {
      continue;
    }

    const configValue = field.values.get(rowIndex);

    if (configValue === null || configValue === undefined) {
      continue;
    }

    const newValue = configDef.handler(configValue, config, context);
    if (newValue != null) {
      (config as any)[configDef.key ?? configDef.configProperty] = newValue;
    }
  }

  if (context.mappingValues) {
    config.mappings = combineValueMappings(context);
  }

  return config;
}

interface FieldToConfigContext {
  mappingValues?: any[];
  mappingColors?: string[];
  mappingTexts?: string[];
}

type FieldToConfigMapHandler = (value: any, config: FieldConfig, context: FieldToConfigContext) => any;

export interface FieldConfigMapDefinition {
  key: string;
  configProperty?: string;
  handler: FieldToConfigMapHandler;
  defaultReducer?: ReducerID;
}

export const configMapHandlers: FieldConfigMapDefinition[] = [
  {
    key: 'max',
    handler: toNumericOrUndefined,
  },
  {
    key: 'min',
    handler: toNumericOrUndefined,
  },
  {
    key: 'unit',
    handler: (value) => value.toString(),
  },
  {
    key: 'decimals',
    handler: toNumericOrUndefined,
  },
  {
    key: 'displayName',
    handler: (value: any) => value.toString(),
  },
  {
    key: 'color',
    handler: (value) => ({ fixedColor: value, mode: FieldColorModeId.Fixed }),
  },
  {
    key: 'threshold1',
    configProperty: 'thresholds',
    handler: (value, config) => {
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
    configProperty: 'mappings',
    defaultReducer: ReducerID.allValues,
    handler: (value, config, context) => {
      console.log('mappings.value', value);
      if (!isArray(value)) {
        return;
      }

      context.mappingValues = value;
      return config.mappings;
    },
  },
  {
    key: 'mappings.color',
    configProperty: 'mappings',
    defaultReducer: ReducerID.allValues,
    handler: (value, config, context) => {
      if (!isArray(value)) {
        return;
      }

      context.mappingColors = value;
      return config.mappings;
    },
  },
  {
    key: 'mappings.text',
    configProperty: 'mappings',
    defaultReducer: ReducerID.allValues,
    handler: (value, config, context) => {
      if (!isArray(value)) {
        return;
      }

      context.mappingTexts = value;
      return config.mappings;
    },
  },
];

function combineValueMappings(context: FieldToConfigContext): ValueMapping[] {
  const valueMap: ValueMap = {
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

let configMapHandlersIndex: Record<string, FieldConfigMapDefinition> | null = null;

export function getConfigMapHandlersIndex() {
  if (configMapHandlersIndex === null) {
    configMapHandlersIndex = {};
    for (const def of configMapHandlers) {
      configMapHandlersIndex[def.key] = def;
    }
  }

  return configMapHandlersIndex;
}

function toNumericOrUndefined(value: any) {
  const numeric = anyToNumber(value);

  if (isNaN(numeric)) {
    return;
  }

  return numeric;
}

export function getConfigHandlerKeyForField(fieldName: string, mappings: FieldToConfigMapping[]) {
  for (const map of mappings) {
    if (fieldName === map.fieldName) {
      return map.configProperty;
    }
  }

  return fieldName.toLowerCase();
}

export function lookUpConfigHandler(key: string | null): FieldConfigMapDefinition | null {
  if (!key) {
    return null;
  }

  return getConfigMapHandlersIndex()[key];
}
