import { map } from 'rxjs/operators';

import { DataTransformerInfo } from '../../types';
import { DataFrame, Field } from '../../types/dataFrame';
import { ArrayVector } from '../../vector/ArrayVector';

import { DataTransformerID } from './ids';

export interface LimitTransformerOptions {
  limitField?: number;
}

const DEFAULT_LIMIT_FIELD = 10;

export const limitTransformer: DataTransformerInfo<LimitTransformerOptions> = {
  id: DataTransformerID.limit,
  name: 'Limit',
  description: 'Limit the number of items to the top N',
  defaultOptions: {
    limitField: DEFAULT_LIMIT_FIELD,
  },

  operator: (options) => (source) =>
    source.pipe(
      map((data) => {
        const limitFieldMatch = options.limitField || DEFAULT_LIMIT_FIELD;

        const processed: DataFrame[] = [];
        const fields: Field[] = [];
        for (const frame of data) {
          for (const field of frame.fields) {
            // No need to process if response < our limit
            if (field.values.length < limitFieldMatch) {
              return data;
            }

            const values = new ArrayVector();
            for (let i = 0; i < limitFieldMatch; i++) {
              values.add(field.values.get(i));
            }

            fields.push({
              name: field.name,
              type: field.type,
              config: {
                ...field.config,
              },
              values: values,
            });
          }
        }

        processed.push({
          fields,
          length: limitFieldMatch,
        });

        return processed;
      })
    ),
};
