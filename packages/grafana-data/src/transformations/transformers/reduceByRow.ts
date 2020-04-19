import { DataFrame, DataTransformerInfo, MatcherConfig, Vector, FieldType, Field, NullValueMode } from '../../types';
import { DataTransformerID } from './ids';
import { ReducerID, fieldReducers } from '../fieldReducer';
import { getFieldMatcher } from '../matchers';
import { FieldMatcherID } from '../matchers/ids';
import { vectorToArray } from '../../vector/vectorToArray';
import { ArrayVector } from '../../vector';
import { doStandardCalcs } from '../fieldReducer';

export interface ReduceByRowOptions {
  reducer: ReducerID;
  fields?: MatcherConfig; // Assume all fields
  alias?: string; // The output field name
  replaceFields?: boolean;
  nullValueMode?: NullValueMode;
}

export const reduceByRowTransformer: DataTransformerInfo<ReduceByRowOptions> = {
  id: DataTransformerID.reduceByRow,
  name: 'Reduce By Row',
  description: 'Run a calculation on the row',
  defaultOptions: {
    reducer: ReducerID.sum,
    appendField: false,
  },
  transformer: options => (data: DataFrame[]) => {
    const matcher = getFieldMatcher(
      options.fields ?? {
        id: FieldMatcherID.numeric,
      }
    );

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
      frame.fields.forEach((field, index) => {
        if (matcher(field)) {
          columns.push(field.values);
        }
      });

      // Prepare a "fake" field for the row
      const iter = new RowVector(frame, columns);
      const row: Field = {
        name: 'temp',
        values: iter,
        type: FieldType.number,
        config: {},
      };
      const vals: number[] = [];
      for (let i = 0; i < frame.length; i++) {
        iter.rowIndex = i;
        row.calcs = undefined;

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
  constructor(private frame: DataFrame, private columns: Vector[]) {}

  rowIndex = 0;

  get length(): number {
    return this.frame.length;
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
