import { DataTransformerInfo, NoopDataTransformer } from './transformers';
import { DataFrame } from '../../types/data';
import { DataMatcherConfig, getDataMatcher } from '../matchers/matchers';
import { DataMatcherID } from '../matchers/ids';
import { DataTransformerID } from './ids';

interface FilterOptions {
  include?: DataMatcherConfig;
  exclude?: DataMatcherConfig;
}

export const filterTransformer: DataTransformerInfo<FilterOptions> = {
  id: DataTransformerID.filter,
  name: 'Filter',
  description: 'select a subset of fields',
  defaultOptions: {
    include: { id: DataMatcherID.numericFields },
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
        const mask: number[] = [];
        for (let i = 0; i < series.fields.length; i++) {
          const field = series.fields[i];
          if (exclude) {
            if (exclude(series, field)) {
              continue;
            }
            if (!include) {
              mask.push(i);
            }
          }
          if (include && include(series, field)) {
            mask.push(i);
          }
        }

        if (!mask.length) {
          continue;
        }
        const copy = {
          ...series,
          fields: mask.map(i => series.fields[i]),
          rows: new Array(series.rows.length),
        };
        for (const row of series.rows) {
          copy.rows.push(mask.map(i => row[i]));
        }
        processed.push(copy);
      }
      return processed;
    };
  },
};
