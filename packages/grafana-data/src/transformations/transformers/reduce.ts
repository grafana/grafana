import { DataTransformerID } from './ids';
import { DataTransformerInfo, MatcherConfig } from '../../types/transformations';
import { fieldReducers, reduceField, ReducerID } from '../fieldReducer';
import { alwaysFieldMatcher } from '../matchers/predicates';
import { DataFrame, Field, FieldType } from '../../types/dataFrame';
import { ArrayVector } from '../../vector/ArrayVector';
import { KeyValue } from '../../types/data';
import { guessFieldTypeForField } from '../../dataframe/processDataFrame';
import { getFieldMatcher } from '../matchers';
import { FieldMatcherID } from '../matchers/ids';
import { filterFieldsTransformer } from './filter';
import { getFieldDisplayName } from '../../field';

export interface ReduceTransformerOptions {
  reducers: ReducerID[];
  fields?: MatcherConfig; // Assume all fields
}

export const reduceTransformer: DataTransformerInfo<ReduceTransformerOptions> = {
  id: DataTransformerID.reduce,
  name: 'Reduce',
  description: 'Reduce all rows or data points to a single value using a function like max, min, mean or last',
  defaultOptions: {
    reducers: [ReducerID.max],
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

      for (let seriesIndex = 0; seriesIndex < data.length; seriesIndex++) {
        const series = data[seriesIndex];
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
            name: info.name,
            type: FieldType.other, // UNKNOWN until after we call the functions
            values: values[values.length - 1],
            config: {},
          });
        }

        for (let i = 0; i < series.fields.length; i++) {
          const field = series.fields[i];

          if (field.type === FieldType.time) {
            continue;
          }

          if (matcher(field, series, data)) {
            const results = reduceField({
              field,
              reducers,
            });

            // Update the name list
            const fieldName = getFieldDisplayName(field, series, data);

            values[0].buffer.push(fieldName);

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

      const withoutTime = filterFieldsTransformer.transformer({ exclude: { id: FieldMatcherID.time } })(processed);
      return mergeResults(withoutTime);
    };
  },
};

const mergeResults = (data: DataFrame[]) => {
  if (data.length <= 1) {
    return data;
  }

  const baseFrame = data[0];

  for (let seriesIndex = 1; seriesIndex < data.length; seriesIndex++) {
    const series = data[seriesIndex];

    for (const baseField of baseFrame.fields) {
      for (const field of series.fields) {
        if (baseField.type !== field.type || baseField.name !== field.name) {
          continue;
        }

        const baseValues: any[] = ((baseField.values as unknown) as ArrayVector).buffer;
        const values: any[] = ((field.values as unknown) as ArrayVector).buffer;
        ((baseField.values as unknown) as ArrayVector).buffer = baseValues.concat(values);
      }
    }
  }

  baseFrame.name = undefined;
  baseFrame.length = baseFrame.fields[0].values.length;

  return [baseFrame];
};
