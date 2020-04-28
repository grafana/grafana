import { DataFrame, DataTransformerInfo, Vector, FieldType, Field, NullValueMode, FieldConfig } from '../../types';
import { DataTransformerID } from './ids';
import { ReducerID, fieldReducers } from '../fieldReducer';
import { getFieldMatcher } from '../matchers';
import { FieldMatcherID } from '../matchers/ids';
import { RowVector } from '../../vector/RowVector';
import { ArrayVector } from '../../vector';
import { doStandardCalcs } from '../fieldReducer';
import { seriesToColumnsTransformer } from './seriesToColumns';
import { getTimeField } from '../../dataframe';

enum CalculateFieldMode {
  ReduceRow = 'reduceRow',
  BinaryOperaticon = 'binary',
  Scale = 'scale',
}

enum BinaryOperator {
  Add = '+',
  Subtract = '-',
  Divide = '/',
  Multiply = '*',
}

interface ReduceOptions {
  include?: string; // Assume all fields
  reducer: ReducerID;
  nullValueMode?: NullValueMode;
}

interface BinaryOptions {
  left: string;
  operator: BinaryOperator;
  right: string;
}

interface ScaleOptions {
  left: string;
  operator: BinaryOperator;
  value: number;
}

export interface CalculateFieldTransformerOptions {
  // True/False or auto
  timeSeries?: boolean;
  mode: CalculateFieldMode;

  // One of the following options is supported
  reduce?: ReduceOptions;
  binary?: BinaryOptions;
  scale?: ScaleOptions;

  // Remove other fields
  replaceFields?: boolean;

  // Output field properties
  alias?: string; // The output field name
  field?: FieldConfig;
}

/**
 * Return true if every frame has a time column
 */
function isTimeSeris(data: DataFrame[]): boolean {
  for (const frame of data) {
    const { timeField } = getTimeField(frame);
    if (!timeField) {
      return false;
    }
  }
  return true;
}

type FieldCreator = (data: DataFrame) => Field;

export const calculateFieldTransformer: DataTransformerInfo<CalculateFieldTransformerOptions> = {
  id: DataTransformerID.calculateField,
  name: 'Add field from calculation',
  description: 'Use the row values to calculate a new field',
  defaultOptions: {
    reducer: ReducerID.sum,
  },
  transformer: options => (data: DataFrame[]) => {
    // Assume timeseries should first be joined by time
    const timeSeries = isTimeSeris(data);
    if (data.length > 1 && timeSeries && options.timeSeries !== false) {
      data = seriesToColumnsTransformer.transformer({
        byField: 'Time',
      })(data);
    }

    const creator = getReduceRowCreator(options.reduce!);

    return data.map(frame => {
      const field = creator(frame);
      if (!field) {
        return frame;
      }

      if (options.alias) {
        field.name = options.alias;
      }
      if (options.field) {
        field.config = options.field;
      }

      let fields: Field[] = [];

      // Replace all fields with the single field
      if (options.replaceFields) {
        const { timeField } = getTimeField(frame);
        if (timeField && options.timeSeries !== false) {
          fields = [timeField, field];
        } else {
          fields = [field];
        }
      } else {
        fields = [...frame.fields, field];
      }

      return {
        ...frame,
        fields,
      };
    });
  },
};

function getReduceRowCreator(options: ReduceOptions): FieldCreator {
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

  return (frame: DataFrame) => {
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

    return {
      name: info.name,
      type: FieldType.number,
      config: {},
      values: new ArrayVector(vals),
    };
  };
}

function valuesFromBinary(options: BinaryOptions, data: DataFrame[]): Vector[] {
  return data.map(frame => {
    // Empty array
    return new ArrayVector([]);
  });
}

function valuesFromScale(options: ScaleOptions, data: DataFrame[]): Vector[] {
  return data.map(frame => {
    // Empty array
    return new ArrayVector([]);
  });
}
