import { DataTransformerInfo, NoopDataTransformer } from './transformers';
import { DataFrame, Field } from '../../types/dataFrame';
import { DataMatcherConfig, getDataMatcher } from '../matchers/matchers';
import { FieldMatcherID } from '../matchers/ids';
import { DataTransformerID } from './ids';

export interface FilterOptions {
  include?: DataMatcherConfig;
  exclude?: DataMatcherConfig;
}

export const filterTransformer: DataTransformerInfo<FilterOptions> = {
  id: DataTransformerID.filter,
  name: 'Filter',
  description: 'select a subset of fields',
  defaultOptions: {
    include: { id: FieldMatcherID.numericFields },
  },

  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  transformer: (options: FilterOptions) => {
    if (!options.include && !options.exclude) {
      return NoopDataTransformer;
    }

    const include = options.include ? getDataMatcher(options.include) : null;

    const exclude = options.exclude ? getDataMatcher(options.exclude) : null;

    return (data: DataFrame[]) => {
      const processed: DataFrame[] = [];
      for (const series of data) {
        // Find the matching field indexes
        const fields: Field[] = [];
        for (let i = 0; i < series.fields.length; i++) {
          const field = series.fields[i];
          if (exclude) {
            if (exclude(series, field)) {
              continue;
            }
            if (!include) {
              fields.push(field);
            }
          }
          if (include && include(series, field)) {
            fields.push(field);
          }
        }

        if (!fields.length) {
          continue;
        }
        const copy = {
          ...series, // all the other properties
          fields, // but a different set of fields
        };
        processed.push(copy);
      }
      return processed;
    };
  },
};
