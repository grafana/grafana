import { map } from 'rxjs/operators';

import { cacheFieldDisplayNames } from '../../field/fieldState';
import { DataFrame, Field, FieldType } from '../../types/dataFrame';
import { DataTransformerInfo, SpecialValue } from '../../types/transformations';

import { DataTransformerID } from './ids';
import { getSpecialValue } from './utils';

export interface TransposeTransformerOptions {
  firstFieldName?: string;
  restFieldsName?: string;
  emptyValue?: SpecialValue;
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
  cacheFieldDisplayNames(data);
  const emptyValue = options.emptyValue ?? SpecialValue.Empty;

  return data.map((frame) => {
    const firstField = frame.fields[0];
    const firstName = !options.firstFieldName ? 'Field' : options.firstFieldName;
    const restName = !options.restFieldsName ? 'Value' : options.restFieldsName;
    const useFirstFieldAsHeaders =
      firstField.type === FieldType.string || firstField.type === FieldType.time || firstField.type === FieldType.enum;
    const headers = useFirstFieldAsHeaders
      ? [firstName, ...fieldValuesAsStrings(firstField, firstField.values, emptyValue)]
      : [firstName, ...firstField.values.map((_, i) => restName)];
    const rows = useFirstFieldAsHeaders
      ? frame.fields
          .map((field) => {
            return field.state?.displayName ?? field.name;
          })
          .slice(1)
      : frame.fields.map((field) => field.state?.displayName ?? field.name);
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
          return fieldValuesAsStrings(field, [field.values[index - 1]], emptyValue)[0];
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

function fieldValuesAsStrings(field: Field, values: unknown[], emptyValue: SpecialValue) {
  switch (field.type) {
    case FieldType.time:
    case FieldType.number:
    case FieldType.boolean:
    case FieldType.string:
      return values.map((v) => (v != null ? `${v}` : getSpecialValue(emptyValue)));
    case FieldType.enum:
      // @ts-ignore
      return values.map((v) => field.config.type!.enum!.text![v] ?? getSpecialValue(emptyValue));
    default:
      return values.map((v) => (v != null ? JSON.stringify(v) : getSpecialValue(emptyValue)));
  }
}
