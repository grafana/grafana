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
  handlerKey: string | null;
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

    const newValue = configDef.processor(configValue, config, context);
    if (newValue != null) {
      (config as any)[configDef.targetProperty ?? configDef.key] = newValue;
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

type FieldToConfigMapHandlerProcessor = (value: any, config: FieldConfig, context: FieldToConfigContext) => any;

export interface FieldToConfigMapHandler {
  key: string;
  targetProperty?: string;
  name?: string;
  processor: FieldToConfigMapHandlerProcessor;
  defaultReducer?: ReducerID;
}

export const configMapHandlers: FieldToConfigMapHandler[] = [
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
    processor: (value: any) => value.toString(),
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

let configMapHandlersIndex: Record<string, FieldToConfigMapHandler> | null = null;

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
      return map.handlerKey;
    }
  }

  return fieldName.toLowerCase();
}

export function lookUpConfigHandler(key: string | null): FieldToConfigMapHandler | null {
  if (!key) {
    return null;
  }

  return getConfigMapHandlersIndex()[key];
}
