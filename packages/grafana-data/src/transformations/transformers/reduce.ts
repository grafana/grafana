import { map } from 'rxjs/operators';

import { guessFieldTypeForField } from '../../dataframe/processDataFrame';
import { getFieldDisplayName } from '../../field';
import { KeyValue } from '../../types/data';
import { DataFrame, Field, FieldType } from '../../types/dataFrame';
import { DataTransformerInfo, FieldMatcher, MatcherConfig } from '../../types/transformations';
import { ArrayVector } from '../../vector/ArrayVector';
import { fieldReducers, reduceField, ReducerID } from '../fieldReducer';
import { getFieldMatcher } from '../matchers';
import { alwaysFieldMatcher, notTimeFieldMatcher } from '../matchers/predicates';

import { DataTransformerID } from './ids';

export enum ReduceTransformerMode {
  SeriesToRows = 'seriesToRows', // default
  ReduceFields = 'reduceFields', // same structure, add additional row for each type
}
export interface ReduceTransformerOptions {
  reducers: ReducerID[];
  fields?: MatcherConfig; // Assume all fields
  mode?: ReduceTransformerMode;
  includeTimeField?: boolean;
  labelsToFields?: boolean;
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
  operator: (options) => (source) =>
    source.pipe(
      map((data) => {
        if (!options?.reducers?.length) {
          return data; // nothing selected
        }

        const matcher = options.fields
          ? getFieldMatcher(options.fields)
          : options.includeTimeField && options.mode === ReduceTransformerMode.ReduceFields
          ? alwaysFieldMatcher
          : notTimeFieldMatcher;

        // Collapse all matching fields into a single row
        if (options.mode === ReduceTransformerMode.ReduceFields) {
          return reduceFields(data, matcher, options.reducers);
        }

        // Add a row for each series
        const res = reduceSeriesToRows(data, matcher, options.reducers, options.labelsToFields);
        return res ? [res] : [];
      })
    ),
};

/**
 * @internal only exported for testing
 */
export function reduceSeriesToRows(
  data: DataFrame[],
  matcher: FieldMatcher,
  reducerId: ReducerID[],
  labelsToFields?: boolean
): DataFrame | undefined {
  const calculators = fieldReducers.list(reducerId);
  const reducers = calculators.map((c) => c.id);
  const processed: DataFrame[] = [];
  const distinctLabels = labelsToFields ? getDistinctLabelKeys(data) : [];

  for (const series of data) {
    const source = series.fields.filter((f) => matcher(f, series, data));

    const size = source.length;
    const fields: Field[] = [];
    const names = new ArrayVector<string>(new Array(size));
    fields.push({
      name: 'Field',
      type: FieldType.string,
      values: names,
      config: {},
    });

    const labels: KeyValue<ArrayVector> = {};
    if (labelsToFields) {
      for (const key of distinctLabels) {
        labels[key] = new ArrayVector<string>(new Array(size));
        fields.push({
          name: key,
          type: FieldType.string,
          values: labels[key],
          config: {},
        });
      }
    }

    const calcs: KeyValue<ArrayVector> = {};
    for (const info of calculators) {
      calcs[info.id] = new ArrayVector(new Array(size));
      fields.push({
        name: info.name,
        type: FieldType.other, // UNKNOWN until after we call the functions
        values: calcs[info.id],
        config: {},
      });
    }

    for (let i = 0; i < source.length; i++) {
      const field = source[i];
      const results = reduceField({
        field,
        reducers,
      });

      if (labelsToFields) {
        names[i] = field.name;
        if (field.labels) {
          for (const key of Object.keys(field.labels)) {
            labels[key][i] = field.labels[key];
          }
        }
      } else {
        names[i] = getFieldDisplayName(field, series, data);
      }

      for (const info of calculators) {
        const v = results[info.id];
        calcs[info.id][i] = v;
      }
    }

    // For reduced fields, we don't know the type until we see the value
    for (const f of fields) {
      if (f.type === FieldType.other) {
        const t = guessFieldTypeForField(f);
        if (t) {
          f.type = t;
        }
      }
    }

    processed.push({
      ...series, // Same properties, different fields
      fields,
      length: size,
    });
  }

  return mergeResults(processed);
}

export function getDistinctLabelKeys(frames: DataFrame[]): string[] {
  const keys = new Set<string>();
  for (const frame of frames) {
    for (const field of frame.fields) {
      if (field.labels) {
        for (const k of Object.keys(field.labels)) {
          keys.add(k);
        }
      }
    }
  }
  return [...keys];
}

/**
 * @internal only exported for testing
 */
export function mergeResults(data: DataFrame[]): DataFrame | undefined {
  if (!data?.length) {
    return undefined;
  }

  const baseFrame = data[0];

  for (let seriesIndex = 1; seriesIndex < data.length; seriesIndex++) {
    const series = data[seriesIndex];

    for (let baseIndex = 0; baseIndex < baseFrame.fields.length; baseIndex++) {
      const baseField = baseFrame.fields[baseIndex];
      for (let fieldIndex = 0; fieldIndex < series.fields.length; fieldIndex++) {
        const field = series.fields[fieldIndex];
        const isFirstField = baseIndex === 0 && fieldIndex === 0;
        const isSameField = baseField.type === field.type && baseField.name === field.name;

        if (isFirstField || isSameField) {
          const baseValues: any[] = baseField.values.toArray();
          const values: any[] = field.values.toArray();
          (baseField.values as unknown as ArrayVector).buffer = baseValues.concat(values);
        }
      }
    }
  }

  baseFrame.name = undefined;
  baseFrame.length = baseFrame.fields[0].values.length;
  return baseFrame;
}

/**
 * @internal -- only exported for testing
 */
export function reduceFields(data: DataFrame[], matcher: FieldMatcher, reducerId: ReducerID[]): DataFrame[] {
  const calculators = fieldReducers.list(reducerId);
  const reducers = calculators.map((c) => c.id);
  const processed: DataFrame[] = [];

  for (const series of data) {
    const fields: Field[] = [];
    for (const field of series.fields) {
      if (matcher(field, series, data)) {
        const results = reduceField({
          field,
          reducers,
        });
        for (const reducer of reducers) {
          const value = results[reducer];
          const copy = {
            ...field,
            values: new ArrayVector([value]),
          };
          copy.state = undefined;
          if (reducers.length > 1) {
            if (!copy.labels) {
              copy.labels = {};
            }
            copy.labels['reducer'] = fieldReducers.get(reducer).name;
          }
          fields.push(copy);
        }
      }
    }
    if (fields.length) {
      processed.push({
        ...series,
        fields,
        length: 1, // always one row
      });
    }
  }

  return processed;
}
