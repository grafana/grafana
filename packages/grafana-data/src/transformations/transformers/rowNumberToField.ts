import { map } from 'rxjs/operators';

import { DataFrame, FieldType } from '../../types/dataFrame';
import { SynchronousDataTransformerInfo } from '../../types/transformations';
import { IndexVector } from '../../vector';

import { DataTransformerID } from './ids';

export interface RowNumberToFieldTransformerOptions {}

export const rowNumberToFieldTransformer: SynchronousDataTransformerInfo<RowNumberToFieldTransformerOptions> = {
  id: DataTransformerID.rowNumberToField,
  name: 'Row number to field',
  description: 'Add the row number of the data frame as a field',
  defaultOptions: {},

  operator: (options, ctx) => (source) =>
    source.pipe(map((data) => rowNumberToFieldTransformer.transformer(options, ctx)(data))),

  transformer: (options) => {
    return (data: DataFrame[]) => {
      if (!data?.length) {
        return data;
      }
      return data.map(getFrameWithRowIndex);
    };
  },
};

// This will make sure the first field contains the row value
function getFrameWithRowIndex(frame: DataFrame): DataFrame {
  const first = frame.fields[0];
  if (first.values instanceof IndexVector) {
    return frame;
  }
  return {
    ...frame,
    fields: [
      {
        name: 'Row',
        type: FieldType.number,
        values: new IndexVector(frame.length),
        config: {
          min: 0,
          max: frame.length - 1,
        },
      },
      ...frame.fields,
    ],
  };
}
