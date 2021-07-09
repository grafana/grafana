import {
  anyToNumber,
  DataFrame,
  FieldColorModeId,
  FieldConfig,
  getFieldDisplayName,
  ReducerID,
  ThresholdsMode,
} from '@grafana/data';

export interface FieldToConfigMapping {
  fieldName: string;
  reducerId?: ReducerID;
  configProperty: string;
}

/**
 * Transforms a frame with fields to a map of field configs
 *
 * Input
 * | Name        | Min | Max |
 * --------------------------------
 * | Temperature |  0  | 30  |
 * | Pressure    |  0  | 100 |
 *
 * Outputs
 * {
    { min: 0, max: 30 },
 * }
 */

export function getFieldConfigFromFrame(
  frame: DataFrame,
  rowIndex: number,
  mappings: FieldToConfigMapping[]
): FieldConfig {
  const config: FieldConfig = {};

  for (const field of frame.fields) {
    const fieldName = getFieldDisplayName(field, frame);
    const configDef = lookUpConfigMapDefinition(fieldName, mappings);

    if (!configDef) {
      continue;
    }

    const configValue = field.values.get(rowIndex);

    if (configValue === null || configValue === undefined) {
      continue;
    }

    const newValue = configDef.handler(configValue, config);
    if (newValue != null) {
      (config as any)[configDef.key ?? configDef.configProperty] = newValue;
    }
  }

  return config;
}

type FieldToConfigMapHandler = (value: any, config: FieldConfig) => any;

export interface FieldConfigMapDefinition {
  key: string;
  configProperty?: string;
  handler: FieldToConfigMapHandler;
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
    handler: (value, config) => value.toString(),
  },
  {
    key: 'decimals',
    handler: toNumericOrUndefined,
  },
  {
    key: 'color',
    handler: (value, config) => ({ fixedColor: value, mode: FieldColorModeId.Fixed }),
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
];

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

export function lookUpConfigMapDefinition(
  fieldName: string,
  mappings: FieldToConfigMapping[]
): FieldConfigMapDefinition | null {
  const index = getConfigMapHandlersIndex();

  for (const map of mappings) {
    if (fieldName === map.fieldName) {
      return index[map.configProperty];
    }
  }

  return index[fieldName] || index[fieldName.toLowerCase()];
}
