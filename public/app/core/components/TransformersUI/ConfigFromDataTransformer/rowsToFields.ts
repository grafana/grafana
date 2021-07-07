import { map } from 'rxjs/operators';
import {
  ArrayVector,
  DataFrame,
  DataTransformerID,
  DataTransformerInfo,
  Field,
  getFieldDisplayName,
} from '@grafana/data';

export interface RowToFieldsTransformOptions {
  nameField: string;
  valueField: string;
  mappings: RowToFieldsTransformMappings[];
}

export interface RowToFieldsTransformMappings {
  fieldName: string;
  configProperty: string;
}

export const configFromDataTransformer: DataTransformerInfo<RowToFieldsTransformOptions> = {
  id: DataTransformerID.configFromData,
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
  let nameField: Field | null = null;
  let valueField: Field | null = null;

  for (const field of data.fields) {
    const fieldName = getFieldDisplayName(field);
    if (fieldName === options.nameField) {
      nameField = field;
    } else if (fieldName === options.valueField) {
      valueField = field;
    }
  }

  if (!nameField || !valueField) {
    return data;
  }

  const outFields: Field[] = [];

  for (let index = 0; index < nameField.values.length; index++) {
    const name = nameField.values.get(index);
    const value = valueField.values.get(index);
    const field: Field = {
      name: name,
      type: valueField.type,
      values: new ArrayVector([value]),
      config: {},
    };

    outFields.push(field);
  }

  return {
    fields: outFields,
    length: 1,
  };
}
