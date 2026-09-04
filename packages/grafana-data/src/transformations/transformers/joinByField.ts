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

export interface JoinByFieldOptions {
  byField?: string; // empty will pick the field automatically
  mode?: JoinMode;
  /**
   * Forward frames that do not have the join field instead of dropping them, so a later
   * join can pick them up. Requires an explicit byField. Off by default: without it, a
   * frame missing the join field is treated as a failed input to this join rather than as
   * one that belongs to a different join.
   */
  keepUnjoinedFrames?: boolean;
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

        // Partitioning here rather than in joinDataFrames keeps the "a frame missing the join
        // field zeroes an inner join" rule intact: joinDataFrames only ever sees participants,
        // so it never sees a dropped frame.
        let frames = data;
        const unjoined: DataFrame[] = [];
        const matcher = joinBy;
        if (options.keepUnjoinedFrames && matcher) {
          const participants: DataFrame[] = [];
          for (const frame of data) {
            if (frame.fields.some((field) => matcher(field, frame, data))) {
              participants.push(frame);
            } else {
              unjoined.push(frame);
            }
          }
          if (participants.length === 0) {
            return data;
          }
          frames = participants;
        }

        const joined = joinDataFrames({ frames, joinBy, mode: options.mode });
        if (joined) {
          const refId = `${DataTransformerID.joinByField}-${frames.map((frame) => frame.refId).join('-')}`;
          // With a single participant joinDataFrames returns the input frame itself, so copy
          // before naming it rather than renaming a frame the caller still holds.
          return [{ ...joined, refId }, ...unjoined];
        }
      }
      return data;
    };
  },
};
