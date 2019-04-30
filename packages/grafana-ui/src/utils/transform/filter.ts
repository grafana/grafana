import { SeriesTransformerInfo, NoopSeriesTransformer } from './transformers';
import { SeriesData } from '../../types/data';
import { DataQueryRequest } from '../../types/index';
import { SeriesMatcherConfig, getSeriesMatcher } from '../matchers/matchers';
import { SeriesMatcherID } from '../matchers/ids';
import { SeriesTransformerID } from './ids';

interface FilterOptions {
  include?: SeriesMatcherConfig;
  exclude?: SeriesMatcherConfig;
}

export const filterTransformer: SeriesTransformerInfo<FilterOptions> = {
  id: SeriesTransformerID.filter,
  name: 'Filter',
  description: 'select a subset of fields',
  defaultOptions: {
    include: { id: SeriesMatcherID.numericFields },
  },

  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  transformer: (options: FilterOptions) => {
    if (!options.include && !options.exclude) {
      return NoopSeriesTransformer;
    }

    const include = options.include ? getSeriesMatcher(options.include) : null;

    const exclude = options.exclude ? getSeriesMatcher(options.exclude) : null;

    return (data: SeriesData[], request?: DataQueryRequest) => {
      const processed: SeriesData[] = [];
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
