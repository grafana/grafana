import { map } from 'rxjs/operators';

import { DataFrame, Field, FieldType } from '../../types/dataFrame';
import { DataTransformerInfo } from '../../types/transformations';
import { IndexVector } from '../../vector';

import { DataTransformerID } from './ids';

export interface RowNumberToFieldTransformerOptions {}

export const rowNumberToFieldTransformer: DataTransformerInfo<RowNumberToFieldTransformerOptions> = {
  id: DataTransformerID.rowNumberToField,
  name: 'Row number to field',
  description: 'Add the row number of the data frame as a field',
  defaultOptions: {},

  operator: (options) => (source) =>
    source.pipe(
      map((data) => {
        if (!Array.isArray(data) || data.length === 0) {
          return data;
        }

        return data.map((frame) => ({
          ...frame,
          fields: addRowNumberField(frame),
        }));
      })
    ),
};

function addRowNumberField(frame: DataFrame): Field[] {
  const rowFieldName = 'row_number';
  const rowNumberFieldIndex = frame.fields.findIndex((field) => field.name === rowFieldName);

  const newField = {
    name: rowFieldName,
    type: FieldType.number,
    values: new IndexVector(frame.length),
    config: {
      min: 0,
      max: frame.length - 1,
    },
  };

  if (rowNumberFieldIndex > -1) {
    frame.fields[rowNumberFieldIndex] = newField;
  } else {
    frame.fields.unshift(newField);
  }

  return frame.fields;
}
