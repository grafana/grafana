import { map } from 'rxjs/operators';

import { DataFrame, Field, FieldType } from '../../types/dataFrame';
import { DataTransformerInfo } from '../../types/transformations';
import { ArrayVector } from '../../vector';

import { DataTransformerID } from './ids';

export interface RowNumberToFieldTransformerOptions {}

export const rowNumberToFieldTransformer: DataTransformerInfo<RowNumberToFieldTransformerOptions> = {
  id: DataTransformerID.rowNumberToField,
  name: 'Row number to column',
  description: 'Extract row number to column',
  defaultOptions: {},

  /**
   * Describe me here
   */
  operator: (options) => (source) =>
    source.pipe(
      map((data) => {
        if (!Array.isArray(data) || data.length === 0) {
          return data;
        }

        return data.map((frame) => ({
          ...frame,
          fields: renumberer(frame),
        }));
      })
    ),
};

const renumberer = (frame: DataFrame): Field[] => {
  const rowNumbers = frame.fields[0].values.toArray().map((value, index) => index + 1);

  frame.fields.unshift({
    name: 'row number',
    type: FieldType.number,
    values: new ArrayVector(rowNumbers),
    config: {},
  });

  return frame.fields;
};
