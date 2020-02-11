import { DataTransformerID } from './ids';
import { MatcherConfig, DataTransformerInfo } from '../../types/transformations';
import { ReducerID, fieldReducers, reduceField } from '../fieldReducer';
import { alwaysFieldMatcher } from '../matchers/predicates';
import { DataFrame, Field, FieldType } from '../../types/dataFrame';
import { ArrayVector } from '../../vector/ArrayVector';
import { KeyValue } from '../../types/data';
import { guessFieldTypeForField } from '../../dataframe/processDataFrame';
import { getFieldMatcher } from '../matchers';

export interface ReduceTransformerOptions {
  reducers: ReducerID[];
  fields?: MatcherConfig; // Assume all fields
}

export const reduceTransformer: DataTransformerInfo<ReduceTransformerOptions> = {
  id: DataTransformerID.reduce,
  name: 'Reducer',
  description: 'Return a DataFrame with the reduction results',
  defaultOptions: {
    reducers: [ReducerID.min, ReducerID.max, ReducerID.mean, ReducerID.last],
  },

  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  transformer: (options: ReduceTransformerOptions) => {
    const matcher = options.fields ? getFieldMatcher(options.fields) : alwaysFieldMatcher;
    const calculators = options.reducers && options.reducers.length ? fieldReducers.list(options.reducers) : [];
    const reducers = calculators.map(c => c.id);

    return (data: DataFrame[]) => {
      const processed: DataFrame[] = [];
      for (const series of data) {
        const values: ArrayVector[] = [];
        const fields: Field[] = [];
        const byId: KeyValue<ArrayVector> = {};
        values.push(new ArrayVector()); // The name
        fields.push({
          name: 'Field',
          type: FieldType.string,
          values: values[0],
          config: {},
        });
        for (const info of calculators) {
          const vals = new ArrayVector();
          byId[info.id] = vals;
          values.push(vals);
          fields.push({
            name: info.id,
            type: FieldType.other, // UNKNOWN until after we call the functions
            values: values[values.length - 1],
            config: {
              title: info.name,
              // UNIT from original field?
            },
          });
        }
        for (let i = 0; i < series.fields.length; i++) {
          const field = series.fields[i];
          if (matcher(field)) {
            const results = reduceField({
              field,
              reducers,
            });
            // Update the name list
            values[0].buffer.push(field.name);
            for (const info of calculators) {
              const v = results[info.id];
              byId[info.id].buffer.push(v);
            }
          }
        }
        for (const f of fields) {
          const t = guessFieldTypeForField(f);
          if (t) {
            f.type = t;
          }
        }
        processed.push({
          ...series, // Same properties, different fields
          fields,
          length: values[0].length,
        });
      }
      return processed;
    };
  },
};
