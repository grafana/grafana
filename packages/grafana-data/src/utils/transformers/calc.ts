import { DataTransformerInfo } from './transformers';
import { DataFrame, FieldType } from '../../types/data';
import { DataMatcherConfig, getDataMatcher } from '../matchers/matchers';
import { alwaysDataMatcher } from '../matchers/predicates';
import { DataTransformerID } from './ids';
import { ReducerID, fieldReducers, reduceField } from '../fieldReducer';

interface CalcOptions {
  calcs: string[];
  matcher?: DataMatcherConfig; // Assume all fields
}

export const calcTransformer: DataTransformerInfo<CalcOptions> = {
  id: DataTransformerID.calc,
  name: 'Calculate',
  description: 'calculate...',
  defaultOptions: {
    calcs: [ReducerID.min, ReducerID.max, ReducerID.mean, ReducerID.last],
  },

  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  transformer: (options: CalcOptions) => {
    const matcher = options.matcher ? getDataMatcher(options.matcher) : alwaysDataMatcher;
    const calculators = fieldReducers.list(options.calcs);
    const reducers = calculators.map(c => c.id);
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

    return (data: DataFrame[]) => {
      const processed: DataFrame[] = [];
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
              const results = reduceField({
                series,
                fieldIndex: i,
                reducers,
              });
              const row: any[] = [];
              row.push(field.name);
              for (const s of reducers) {
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
