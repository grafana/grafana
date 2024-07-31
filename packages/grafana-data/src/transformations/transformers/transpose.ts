import { map } from 'rxjs/operators';

import { DataFrame, Field, FieldType } from '../../types/dataFrame';
import { DataTransformerInfo } from '../../types/transformations';

import { DataTransformerID } from './ids';

export interface TransposeTransformerOptions {
  /**
   * Add new field names to dataframe
   */
  addNewFields?: boolean;
  /**
   * Rename the first field
   */
  renameFirstField?: string;
}

export const transposeTransformer: DataTransformerInfo<TransposeTransformerOptions> = {
  id: DataTransformerID.transpose,
  name: 'Transpose',
  description: 'Transpose the data frame',
  defaultOptions: {
    addNewFields: false,
    renameFirstField: '',
  },

  operator: (options) => (source) =>
    source.pipe(
      map((data) => {
        if (data.length === 0) {
          return data;
        }
        return transposeDataFrame(options, data);
      })
    ),
};

function transposeDataFrame(options: TransposeTransformerOptions, data: DataFrame[]): DataFrame[] {
  return data.map((frame) => {
    const firstField = frame.fields[0];
    const headers = options.addNewFields
      ? ['Field', ...firstField.values.map((_, i) => `Value${i + 1}`)]
      : [firstField.name, ...fieldValuesAsStrings(firstField, firstField.values)];
    const rows = options.addNewFields
      ? frame.fields.map((field) => field.name)
      : frame.fields.map((field) => field.name).slice(1);
    const fieldType = determineFieldType(
      options.addNewFields ? frame.fields.map((field) => field.type) : frame.fields.map((field) => field.type).slice(1)
    );

    const newFields = headers.map((fieldName, index) => {
      if (index === 0) {
        return {
          name: !options.renameFirstField
            ? fieldName
            : options.renameFirstField === ''
              ? fieldName
              : options.renameFirstField,
          type: FieldType.string,
          config: {},
          values: rows,
        };
      }

      return {
        name: fieldName,
        type: fieldType,
        config: {},
        values: options.addNewFields
          ? frame.fields.map((field) => {
              if (fieldType === FieldType.string) {
                return fieldValuesAsStrings(field, [field.values[index - 1]])[0];
              }
              return field.values[index - 1];
            })
          : frame.fields
              .map((field) => {
                if (fieldType === FieldType.string) {
                  return fieldValuesAsStrings(field, [field.values[index - 1]])[0];
                }
                return field.values[index - 1];
              })
              .slice(1),
      };
    });
    return {
      ...frame,
      fields: newFields,
      length: Math.max(...newFields.map((field) => field.values.length)),
    };
  });
}

function determineFieldType(fieldTypes: FieldType[]): FieldType {
  const uniqueFieldTypes = new Set(fieldTypes);
  return uniqueFieldTypes.size === 1 ? [...uniqueFieldTypes][0] : FieldType.string;
}

function fieldValuesAsStrings(field: Field, values: any[]) {
  switch (field.type) {
    case FieldType.time:
    case FieldType.number:
    case FieldType.boolean:
    case FieldType.string:
      return values.map((v) => `${v}`);
    case FieldType.enum:
      return values.map((v) => field.config.type!.enum!.text![v]);
    default:
      return values.map((v) => JSON.stringify(v));
  }
}
