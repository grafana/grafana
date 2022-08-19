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

export interface SeriesToColumnsOptions {
  byField?: string; // empty will pick the field automatically
  mode?: JoinMode;
}

export const seriesToColumnsTransformer: SynchronousDataTransformerInfo<SeriesToColumnsOptions> = {
  id: DataTransformerID.seriesToColumns,
  name: 'Series as columns', // Called 'Outer join' in the UI!
  description: 'Groups series by field and returns values as columns',
  defaultOptions: {
    byField: undefined, // DEFAULT_KEY_FIELD,
    mode: JoinMode.outer,
  },

  operator: (options) => (source) => source.pipe(map((data) => seriesToColumnsTransformer.transformer(options)(data))),

  transformer: (options: SeriesToColumnsOptions) => {
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
