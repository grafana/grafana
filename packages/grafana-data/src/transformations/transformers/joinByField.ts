import { map } from 'rxjs/operators';

import { DataFrame, SynchronousDataTransformerInfo } from '../../types';

import { DataTransformerID } from './ids';
import { joinDataFrames } from './joinDataFrames';

export enum JoinMode {
  outer = 'outer',
  inner = 'inner',
}

export interface JoinByFieldOptions {
  fields?: { [key: string]: string }; // empty will pick the field automatically
  mode?: JoinMode;
}

export const joinByFieldTransformer: SynchronousDataTransformerInfo<JoinByFieldOptions> = {
  id: DataTransformerID.joinByField,
  aliasIds: [DataTransformerID.seriesToColumns],
  name: 'Join by field',
  description:
    'Combine rows from two or more tables, based on a related field between them.  This can be used to outer join multiple time series on the _time_ field to show many time series in one table.',
  defaultOptions: {
    fields: {}, // DEFAULT_KEY_FIELD,
    mode: JoinMode.outer,
  },

  operator: (options, ctx) => (source) =>
    source.pipe(map((data) => joinByFieldTransformer.transformer(options, ctx)(data))),

  transformer: (options: JoinByFieldOptions) => {
    return (data: DataFrame[]) => {
      if (data.length > 1) {
        const joined = joinDataFrames({ frames: data, mode: options.mode, fields: options.fields });
        if (joined) {
          return [joined];
        }
      }

      return data;
    };
  },
};
