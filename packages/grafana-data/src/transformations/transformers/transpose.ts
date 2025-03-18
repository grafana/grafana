import { map } from 'rxjs/operators';

import { DataFrame, Field, FieldType } from '../../types/dataFrame';
import { DataTransformerInfo } from '../../types/transformations';

import { DataTransformerID } from './ids';

export interface TransposeTransformerOptions {
  firstFieldName?: string;
  restFieldsName?: string;
}

export const transposeTransformer: DataTransformerInfo<TransposeTransformerOptions> = {
  id: DataTransformerID.transpose,
  name: 'Transpose',
  description: 'Transpose the data frame',
  defaultOptions: {},

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
    const firstName = !options.firstFieldName ? 'Field' : options.firstFieldName;
    const restName = !options.restFieldsName ? 'Value' : options.restFieldsName;
    const useFirstFieldAsHeaders =
      firstField.type === FieldType.string || firstField.type === FieldType.time || firstField.type === FieldType.enum;
    const headers = useFirstFieldAsHeaders
      ? [firstName, ...fieldValuesAsStrings(firstField, firstField.values)]
      : [firstName, ...firstField.values.map((_, i) => restName)];
    const rows = useFirstFieldAsHeaders
      ? frame.fields.map((field) => field.name).slice(1)
      : frame.fields.map((field) => field.name);
    const fieldType = determineFieldType(
      useFirstFieldAsHeaders
        ? frame.fields.map((field) => field.type).slice(1)
        : frame.fields.map((field) => field.type)
    );

    const newFields = headers.map((fieldName, index) => {
      if (index === 0) {
        return {
          name: firstName,
          type: FieldType.string,
          config: {},
          values: rows,
        };
      }

      const values = frame.fields.map((field) => {
        if (fieldType === FieldType.string) {
          return fieldValuesAsStrings(field, [field.values[index - 1]])[0];
        }
        return field.values[index - 1];
      });

      const labelName = useFirstFieldAsHeaders ? firstField.name : 'row';
      const labelValue = useFirstFieldAsHeaders ? fieldName : index;

      return {
        name: useFirstFieldAsHeaders ? restName : fieldName,
        labels: {
          [labelName]: labelValue,
        },
        type: fieldType,
        config: {},
        values: useFirstFieldAsHeaders ? values.slice(1) : values,
      };
    });
    return {
      ...frame,
      fields: newFields,
      length: Math.max(...newFields.map((field) => field.values.length)),
      refId: `${DataTransformerID.transpose}-${frame.refId}`,
    };
  });
}

function determineFieldType(fieldTypes: FieldType[]): FieldType {
  const uniqueFieldTypes = new Set(fieldTypes);
  return uniqueFieldTypes.size === 1 ? [...uniqueFieldTypes][0] : FieldType.string;
}

function fieldValuesAsStrings(field: Field, values: unknown[]) {
  switch (field.type) {
    case FieldType.time:
    case FieldType.number:
    case FieldType.boolean:
    case FieldType.string:
      return values.map((v) => `${v}`);
    case FieldType.enum:
      // @ts-ignore
      return values.map((v) => field.config.type!.enum!.text![v]);
    default:
      return values.map((v) => JSON.stringify(v));
  }
}
