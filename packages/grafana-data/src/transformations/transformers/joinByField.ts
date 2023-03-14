import { map } from 'rxjs/operators';

import { DataFrame, SynchronousDataTransformerInfo, FieldMatcher } from '../../types';
import { fieldMatchers } from '../matchers';
import { FieldMatcherID } from '../matchers/ids';

import { DataTransformerID } from './ids';
import { joinDataFrames } from './joinDataFrames';

export enum JoinMode {
  outer = 'outer',
  inner = 'inner',
}

export interface JoinByFieldOptions {
  byField?: string; // empty will pick the field automatically
  mode?: JoinMode;
}

export const joinByFieldTransformer: SynchronousDataTransformerInfo<JoinByFieldOptions> = {
  id: DataTransformerID.joinByField,
  aliasIds: [DataTransformerID.seriesToColumns],
  name: 'Join by field',
  description:
    'Combine rows from two or more tables, based on a related field between them.  This can be used to outer join multiple time series on the _time_ field to show many time series in one table.',
  defaultOptions: {
    byField: undefined, // DEFAULT_KEY_FIELD,
    mode: JoinMode.outer,
  },

  operator: (options, ctx) => (source) =>
    source.pipe(map((data) => joinByFieldTransformer.transformer(options, ctx)(data))),

  transformer: (options: JoinByFieldOptions) => {
    let joinBy: FieldMatcher | undefined = undefined;
    return (data: DataFrame[]) => {
      if (data.length > 1) {
        if (options.byField && !joinBy) {
          joinBy = fieldMatchers.get(FieldMatcherID.byName).get(options.byField);
        }
        const joined = joinDataFrames({ frames: data, joinBy, mode: options.mode });
        if (joined) {
          return [joined];
        }
      }
      return data;
    };
  },
};
