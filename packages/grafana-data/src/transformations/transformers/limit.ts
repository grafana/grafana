import { map } from 'rxjs/operators';

import { DataTransformerInfo } from '../../types/transformations';

import { DataTransformerID } from './ids';

export interface LimitTransformerOptions {
  limitField?: number | string;
}

const DEFAULT_LIMIT_FIELD = 10;

export const limitTransformer: DataTransformerInfo<LimitTransformerOptions> = {
  id: DataTransformerID.limit,
  name: 'Limit',
  description: 'Limit the number of items to the top N',
  defaultOptions: {
    limitField: DEFAULT_LIMIT_FIELD,
  },

  operator: (options, ctx) => (source) =>
    source.pipe(
      map((data) => {
        let limit = DEFAULT_LIMIT_FIELD;
        if (options.limitField !== undefined) {
          if (typeof options.limitField === 'string') {
            limit = parseInt(options.limitField, 10);
          } else {
            limit = options.limitField;
          }
        }

        return data.map((frame) => {
          if (frame.length > limit) {
            return {
              ...frame,
              fields: frame.fields.map((f) => {
                return {
                  ...f,
                  // Clear cached field calculations since applying a limit changes the dataset
                  // and previously computed stats (min, max, mean, etc.) are no longer valid
                  state: {
                    ...f.state,
                    calcs: undefined,
                  },
                  values:
                    limit >= 0 ? f.values.slice(0, limit) : f.values.slice(f.values.length + limit, f.values.length),
                };
              }),
              length: Math.abs(limit),
            };
          }

          return frame;
        });
      })
    ),
};
