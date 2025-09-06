import { map } from 'rxjs/operators';

import { DataFrame } from '../../types/dataFrame';
import { DataTransformContext, FieldMatcher, SynchronousDataTransformerInfo } from '../../types/transformations';
import { fieldMatchers } from '../matchers';
import { FieldMatcherID } from '../matchers/ids';

import { DataTransformerID } from './ids';
import { joinDataFrames } from './joinDataFrames';

export enum JoinMode {
  outer = 'outer', // best for time series, non duplicated join on values
  inner = 'inner',
  outerTabular = 'outerTabular', // best for tabular data where the join on value can be duplicated
}

export interface JoinByFieldOptions {
  byField?: string; // empty will pick the field automatically
  mode?: JoinMode;
  frameAlias?: string;
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

  transformer: (options: JoinByFieldOptions, ctx: DataTransformContext) => {
    let joinBy: FieldMatcher | undefined = undefined;
    return (data: DataFrame[]) => {
      if (data.length > 1) {
        if (options.byField && !joinBy) {
          joinBy = fieldMatchers.get(FieldMatcherID.byName).get(options.byField);
        }
        const joined = joinDataFrames({ frames: data, joinBy, mode: options.mode });
        if (joined) {
          const newRefId =
            options.frameAlias ?? `${DataTransformerID.joinByField}-${data.map((frame) => frame.refId).join('-')}`;
          joined.refId = newRefId;
          return [joined];
        }
      }
      return data;
    };
  },
};
