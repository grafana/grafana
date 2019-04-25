import { SeriesTransformer, seriesTransformers, SeriesTransformerID } from './transformers';
import { SeriesData } from '../../types/data';
import { DataQueryRequest } from '../../types/index';
import { SeriesDataMatcherConfig, SeriesDataMatcherID, seriesDataMatches } from '../matchers/index';

interface FilterOptions {
  include?: SeriesDataMatcherConfig;
  exclude?: SeriesDataMatcherConfig;
}

const filterTransformer: SeriesTransformer<FilterOptions> = {
  id: SeriesTransformerID.filter,
  name: 'Filter',
  description: 'select a subset of fields',
  defaultOptions: {
    include: { id: SeriesDataMatcherID.numericFields },
  },

  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  transform: (options: FilterOptions, data: SeriesData[], request?: DataQueryRequest) => {
    const { include, exclude } = options;
    if (!include && !exclude) {
      return data; // no change
    }

    const processed: SeriesData[] = [];
    for (const series of data) {
      // Find the matching field indexes
      const mask: number[] = [];
      for (let i = 0; i < series.fields.length; i++) {
        const field = series.fields[i];
        if (exclude) {
          if (seriesDataMatches(exclude, series, field)) {
            continue;
          }
          if (!include) {
            mask.push(i);
          }
        }
        if (include && seriesDataMatches(include, series, field)) {
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
  },
};

seriesTransformers.register(filterTransformer);
