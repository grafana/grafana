import { DataFrame, DataTransformerInfo, Vector, FieldType, Field, NullValueMode } from '../../types';
import { DataTransformerID } from './ids';
import { ReducerID, fieldReducers } from '../fieldReducer';
import { getFieldMatcher } from '../matchers';
import { FieldMatcherID } from '../matchers/ids';
import { vectorToArray } from '../../vector/vectorToArray';
import { ArrayVector } from '../../vector';
import { doStandardCalcs } from '../fieldReducer';

export interface CalculateFieldTransformerOptions {
  reducer: ReducerID;
  include?: string; // Assume all fields
  alias?: string; // The output field name
  replaceFields?: boolean;
  nullValueMode?: NullValueMode;
}

export const calculateFieldTransformer: DataTransformerInfo<CalculateFieldTransformerOptions> = {
  id: DataTransformerID.calculateField,
  name: 'Calculate Field',
  description: 'Calculate a new field based on values in the same row',
  defaultOptions: {
    reducer: ReducerID.sum,
  },
  transformer: options => (data: DataFrame[]) => {
    let matcher = getFieldMatcher({
      id: FieldMatcherID.numeric,
    });
    if (options.include && options.include.length) {
      matcher = getFieldMatcher({
        id: FieldMatcherID.byName,
        options: options.include,
      });
    }

    const info = fieldReducers.get(options.reducer);
    if (!info) {
      throw new Error(`Unknown reducer: ${options.reducer}`);
    }
    const reducer = info.reduce ?? doStandardCalcs;
    const ignoreNulls = options.nullValueMode === NullValueMode.Ignore;
    const nullAsZero = options.nullValueMode === NullValueMode.AsZero;

    return data.map(frame => {
      // Find the columns that should be examined
      const columns: Vector[] = [];
      frame.fields.forEach(field => {
        if (matcher(field)) {
          columns.push(field.values);
        }
      });

      // Prepare a "fake" field for the row
      const iter = new RowVector(columns);
      const row: Field = {
        name: 'temp',
        values: iter,
        type: FieldType.number,
        config: {},
      };
      const vals: number[] = [];
      for (let i = 0; i < frame.length; i++) {
        iter.rowIndex = i;
        row.calcs = undefined; // bust the cache (just in case)
        const val = reducer(row, ignoreNulls, nullAsZero)[options.reducer];
        vals.push(val);
      }

      const field = {
        name: options.alias || info.name,
        type: FieldType.number,
        config: {},
        values: new ArrayVector(vals),
      };

      return {
        ...frame,
        fields: options.replaceFields ? [field] : [...frame.fields, field],
      };
    });
  },
};

class RowVector implements Vector<number> {
  constructor(private columns: Vector[]) {}

  rowIndex = 0;

  get length(): number {
    return this.columns.length;
  }

  get(index: number): number {
    return this.columns[index].get(this.rowIndex);
  }

  toArray(): number[] {
    return vectorToArray(this);
  }

  toJSON(): number[] {
    return vectorToArray(this);
  }
}
