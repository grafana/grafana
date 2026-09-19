import { map } from 'rxjs/operators';

import { type DataFrame } from '../../types/dataFrame';
import {
  type DataTransformContext,
  type FieldMatcher,
  type SynchronousDataTransformerInfo,
} from '../../types/transformations';
import { fieldMatchers } from '../matchers';
import { FieldMatcherID } from '../matchers/ids';

import { DataTransformerID } from './ids';
import { joinDataFrames } from './joinDataFrames';
import { JoinMode } from './joinShared';
import { getTransformationDynamicRefId } from './utils';

export interface JoinByFieldOptions {
  byField?: string; // empty will pick the field automatically
  mode?: JoinMode;
  refId?: string;
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
          joined.refId = options.refId ?? getTransformationDynamicRefId(DataTransformerID.joinByField, data);
          return [joined];
        }
      }
      return data;
    };
  },

  usesDynamicRefId: true,
};
