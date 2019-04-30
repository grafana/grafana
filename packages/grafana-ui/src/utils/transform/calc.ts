import { SeriesTransformerInfo } from './transformers';
import { SeriesData, FieldType } from '../../types/data';
import { DataQueryRequest } from '../../types/index';
import { StatID, statsCalculators, calculateStats } from '../statsCalculator';
import { SeriesMatcherConfig, getSeriesMatcher } from '../matchers/matchers';
import { alwaysSeriesMatcher } from '../matchers/predicates';
import { SeriesTransformerID } from './ids';

interface CalcOptions {
  stats: string[];
  matcher?: SeriesMatcherConfig; // Assume all fields
}

export const calcTransformer: SeriesTransformerInfo<CalcOptions> = {
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
  transformer: (options: CalcOptions) => {
    const matcher = options.matcher ? getSeriesMatcher(options.matcher) : alwaysSeriesMatcher;
    const calculators = statsCalculators.list(options.stats);
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

    return (data: SeriesData[], request?: DataQueryRequest) => {
      const processed: SeriesData[] = [];
      for (const series of data) {
        if (matcher(series)) {
          const sub = {
            ...series,
            fields,
            rows: [] as any[], // empty rows
          };
          for (let i = 0; i < series.fields.length; i++) {
            const field = series.fields[i];
            if (matcher(series, field)) {
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
    };
  },
};
