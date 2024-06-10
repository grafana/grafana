import { map } from 'rxjs/operators';

import { DataFrame, FieldType } from '../../types/dataFrame';
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
    const headers = options.addNewFields
      ? ['Field'].concat(Array.from({ length: frame.fields[0].values.length }, (_, i) => `Value${i + 1}`))
      : [frame.fields[0].name].concat(
          frame.fields[0].values.map((value) => convertValueToString(frame.fields[0].type, value))
        );
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
          values: rows,
          type: FieldType.string,
          config: {},
        };
      }
      return {
        name: fieldName,
        values: options.addNewFields
          ? frame.fields.map((field) => {
              if (fieldType === FieldType.string) {
                return convertValueToString(field.type, field.values[index - 1]);
              }
              return field.values[index - 1];
            })
          : frame.fields
              .map((field) => {
                if (fieldType === FieldType.string) {
                  return convertValueToString(field.type, field.values[index - 1]);
                }
                return field.values[index - 1];
              })
              .slice(1),
        type: fieldType,
        config: {},
      };
    });
    return {
      ...frame,
      fields: newFields,
      length: newFields.map((field) => field.values.length).reduce((a, b) => Math.max(a, b), 0),
    };
  });
}

function determineFieldType(fieldTypes: FieldType[]): FieldType {
  const uniqueFieldTypes = Array.from(new Set(fieldTypes));
  if (uniqueFieldTypes.length === 1) {
    return uniqueFieldTypes[0];
  }
  return FieldType.string;
}

function convertValueToString(originalFieldType: FieldType, value: any): string {
  switch (originalFieldType) {
    case FieldType.string:
      return value;
    case FieldType.boolean:
      return value ? 'true' : 'false';
    case FieldType.number:
      return value.toString();
    case FieldType.time:
      return value.toString();
    case FieldType.other:
      return JSON.stringify(value);
    case FieldType.frame:
      return value.name;
    default:
      return value.toString();
  }
}
