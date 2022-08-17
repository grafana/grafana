import { map } from 'rxjs/operators';

import { DataFrame, SynchronousDataTransformerInfo, FieldMatcher } from '../../types';
import { fieldMatchers } from '../matchers';
import { FieldMatcherID } from '../matchers/ids';

import { DataTransformerID } from './ids';
import { joinDataFrames } from './joinDataFrames';

export interface InnerJoinOptions {
  byField?: string; // empty will pick the field automatically
}

export const innerJoinTransformer: SynchronousDataTransformerInfo<InnerJoinOptions> = {
  id: DataTransformerID.innerJoin,
  name: 'Inner join',
  description:
    'Joins many time series/tables by a field and drops rows where the join field cannot be resolved across different time series/tables.',
  defaultOptions: {
    byField: undefined, // DEFAULT_KEY_FIELD,
  },

  operator: (options) => (source) => source.pipe(map((data) => innerJoinTransformer.transformer(options)(data))),

  transformer: (options: InnerJoinOptions) => {
    let joinBy: FieldMatcher | undefined = undefined;
    return (data: DataFrame[]) => {
      if (data.length > 1) {
        if (options.byField && !joinBy) {
          joinBy = fieldMatchers.get(FieldMatcherID.byName).get(options.byField);
        }
        const joined = joinDataFrames({ frames: data, innerJoin: true, joinBy });
        if (joined) {
          return [joined];
        }
      }
      return data;
    };
  },
};
