import { map } from 'rxjs/operators';

import { DataTransformerInfo } from '../../types/transformations';

import { DataTransformerID } from './ids';
import { transformationsVariableSupport } from './utils';

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
            if (transformationsVariableSupport()) {
              limit = parseInt(ctx.interpolate(options.limitField), 10);
            } else {
              limit = parseInt(options.limitField, 10);
            }
          } else {
            limit = options.limitField;
          }
        }
        // Prevent negative limit
        if (limit < 0) {
          limit = 0;
        }
        return data.map((frame) => {
          if (frame.length > limit) {
            return {
              ...frame,
              fields: frame.fields.map((f) => {
                return {
                  ...f,
                  values: f.values.slice(0, limit),
                };
              }),
              length: limit,
            };
          }

          return frame;
        });
      })
    ),
};
