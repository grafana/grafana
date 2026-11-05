import { map } from 'rxjs/operators';

import { sortDataFrameByFields } from '../../dataframe/processDataFrame';
import { getFieldDisplayName } from '../../field/fieldState';
import { type DataFrame } from '../../types/dataFrame';
import { type DataTransformContext, type DataTransformerInfo } from '../../types/transformations';

import { DataTransformerID } from './ids';

export interface SortByField {
  field: string;
  desc?: boolean;
  index?: number;
}

export interface SortByTransformerOptions {
  // Earlier entries take priority; later ones only break ties.
  sort: SortByField[];
}

export const sortByTransformer: DataTransformerInfo<SortByTransformerOptions> = {
  id: DataTransformerID.sortBy,
  name: 'Sort by',
  description: 'Sort fields in a frame.',
  defaultOptions: {
    fields: {},
  },

  /**
   * Return a modified copy of the series. If the transform is not or should not
   * be applied, just return the input series
   */
  operator: (options, ctx) => (source) =>
    source.pipe(
      map((data) => {
        if (!Array.isArray(data) || data.length === 0 || !options?.sort?.length) {
          return data;
        }
        return sortDataFrames(data, options.sort, ctx);
      })
    ),
};

function sortDataFrames(data: DataFrame[], sort: SortByField[], ctx: DataTransformContext): DataFrame[] {
  return data.map((frame) => {
    const sorts = attachFieldIndex(frame, sort, ctx).map(({ index = -1, desc }) => ({ index, desc }));
    return sortDataFrameByFields(frame, sorts);
  });
}

function attachFieldIndex(frame: DataFrame, sort: SortByField[], ctx: DataTransformContext): SortByField[] {
  return sort.map((s) => {
    if (s.index != null) {
      // null or undefined
      return s;
    }

    return {
      ...s,
      index: frame.fields.findIndex((f) => s.field === getFieldDisplayName(f, frame)),
    };
  });
}
