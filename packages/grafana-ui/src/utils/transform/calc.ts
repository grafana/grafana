import { SeriesTransformer, seriesTransformers, SeriesTransformerID } from './transformers';
import { SeriesData, FieldType } from '../../types/data';
import { DataQueryRequest } from '../../types/index';
import { StatID, getStatsCalculators, calculateStats } from '../statsCalculator';
import { SeriesDataMatcherConfig, seriesDataMatchers } from '../matchers/matchers';
import { alwaysSeriesMatcher } from '../matchers/predicates';

interface CalcOptions {
  stats: string[];
  matcher?: SeriesDataMatcherConfig;
}

const calcTransformer: SeriesTransformer<CalcOptions> = {
  id: SeriesTransformerID.calc,
  name: 'Calculate',
  description: 'calculate...',
  defaultOptions: {
    stats: [StatID.min, StatID.max, StatID.mean, StatID.last],
  },

  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  transform: (options: CalcOptions, data: SeriesData[], request?: DataQueryRequest) => {
    const matcher = options.matcher ? seriesDataMatchers.get(options.matcher.id) : alwaysSeriesMatcher;
    const matcherOptions = options.matcher ? options.matcher.options : {};

    const calculators = getStatsCalculators(options.stats);
    const stats = calculators.map(c => c.id);
    const fields = [
      {
        name: 'Field',
        type: FieldType.string,
      },
      ...calculators.map(info => {
        return {
          name: info.name,
        };
      }),
    ];

    const processed: SeriesData[] = [];
    for (const series of data) {
      if (matcher.matches(matcherOptions, series)) {
        const sub = {
          ...series,
          fields,
          rows: [] as any[], // empty rows
        };
        for (let i = 0; i < series.fields.length; i++) {
          const field = series.fields[i];
          if (matcher.matches(matcherOptions, series, field)) {
            const results = calculateStats({
              series,
              fieldIndex: i,
              stats,
            });
            const row: any[] = [];
            row.push(field.name);
            for (const s of stats) {
              row.push(results[s]);
            }
            sub.rows.push(row);
          }
        }
        processed.push(sub);
      }
    }
    return processed;
  },
};

seriesTransformers.register(calcTransformer);
