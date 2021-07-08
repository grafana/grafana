import { map } from 'rxjs/operators';
import {
  anyToNumber,
  ArrayVector,
  DataFrame,
  DataTransformerID,
  DataTransformerInfo,
  Field,
  FieldColorModeId,
  FieldConfig,
  FieldType,
  getFieldDisplayName,
  ReducerID,
  ThresholdsMode,
} from '@grafana/data';

export interface RowToFieldsTransformOptions {
  nameField?: string;
  valueField?: string;
  mappings?: RowToFieldsTransformMappings[];
}

export interface RowToFieldsTransformMappings {
  fieldName: string;
  reducerId?: ReducerID;
  configProperty: string;
}

export const rowsToFieldsTransformer: DataTransformerInfo<RowToFieldsTransformOptions> = {
  id: DataTransformerID.rowsToFields,
  name: 'Rows to fields',
  description: 'Convert rows to fields with dynamic config',
  defaultOptions: {},

  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  operator: (options) => (source) =>
    source.pipe(
      map((data) => {
        // Ignore if we have more than one frame
        if (data.length !== 1) {
          return data;
        }

        return [rowsToFields(options, data[0])];
      })
    ),
};

export function rowsToFields(options: RowToFieldsTransformOptions, data: DataFrame): DataFrame {
  const mappings = options.mappings || [];

  let nameField: Field | null = null;
  let valueField: Field | null = null;

  for (const field of data.fields) {
    const fieldName = getFieldDisplayName(field, data);

    if (!nameField) {
      // When no name field defined default to first string field
      if (options.nameField == null && field.type === FieldType.string) {
        nameField = field;
        continue;
      } else if (fieldName === options.nameField) {
        nameField = field;
      }
    }

    if (!valueField) {
      // When no value field defined default to first number field
      if (options.valueField == null && field.type === FieldType.number) {
        valueField = field;
        continue;
      } else if (fieldName === options.valueField) {
        valueField = field;
      }
    }
  }

  if (!nameField || !valueField) {
    return data;
  }

  const outFields: Field[] = [];

  for (let index = 0; index < nameField.values.length; index++) {
    const name = nameField.values.get(index);
    const value = valueField.values.get(index);
    const config = getFieldConfigFromFrame(data, index, mappings);

    const field: Field = {
      name: name,
      type: valueField.type,
      values: new ArrayVector([value]),
      config: config,
    };

    outFields.push(field);
  }

  return {
    fields: outFields,
    length: 1,
  };
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
  mappings: RowToFieldsTransformMappings[]
): FieldConfig {
  const config: FieldConfig = {};

  for (const field of frame.fields) {
    const fieldName = getFieldDisplayName(field, frame);
    const configProperty = lookUpConfigMapDefinition(fieldName, mappings);

    if (!configProperty) {
      continue;
    }

    const configValue = field.values.get(rowIndex);

    if (configValue === null || configValue === undefined) {
      continue;
    }

    if (typeof configProperty === 'function') {
      configProperty(configValue, config);
    } else {
      config[configProperty] = configValue;
    }
  }

  return config;
}

type FieldToConfigMapDef = keyof FieldConfig | ((value: any, config: FieldConfig) => void);

export const configMapHandlers: Record<string, FieldToConfigMapDef> = {
  max: 'max',
  min: 'min',
  unit: 'unit',
  decimals: 'decimals',
  color: (value, config) => {
    config.color = { fixedColor: value, mode: FieldColorModeId.Fixed };
  },
  threshold1: (value, config) => {
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
  },
};

function lookUpConfigMapDefinition(fieldName: string, mappings: RowToFieldsTransformMappings[]) {
  for (const map of mappings) {
    if (fieldName === map.fieldName) {
      return configMapHandlers[map.configProperty];
    }
  }

  return configMapHandlers[fieldName] || configMapHandlers[fieldName.toLowerCase()];
}
