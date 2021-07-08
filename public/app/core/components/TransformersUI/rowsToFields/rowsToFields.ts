import { map } from 'rxjs/operators';
import {
  ArrayVector,
  DataFrame,
  DataTransformerID,
  DataTransformerInfo,
  Field,
  FieldType,
  getFieldDisplayName,
  ReducerID,
} from '@grafana/data';
import { getFieldConfigFromFrame } from './shared';

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
  description: 'Convert each row into a field with dynamic config',
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
