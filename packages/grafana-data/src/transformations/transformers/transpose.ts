import { map } from 'rxjs/operators';

import { DataFrame, FieldType } from '../../types/dataFrame';
import { DataTransformerInfo } from '../../types/transformations';

import { DataTransformerID } from './ids';

export interface TransposeTransformerOptions {}

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
        return transposeDataFrame(data);
      })
    ),
};

function transposeDataFrame(data: DataFrame[]): DataFrame[] {
  return data.map((frame) => {
    const headers = [frame.fields[0].name].concat(frame.fields[0].values);
    const rows = frame.fields.map((field) => field.name).slice(1);
    const fieldType = determineFieldType(frame.fields.map((field) => field.type).slice(1));

    const newFields = headers.map((fieldName, index) => {
      if (index === 0) {
        return {
          name: fieldName,
          values: rows,
          type: FieldType.string,
          config: {},
        };
      }
      return {
        name: fieldName,
        values: frame.fields.map((field) => field.values[index - 1]).slice(1),
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
