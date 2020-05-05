import { DataFrame, DataTransformerInfo, Vector, FieldType, Field, NullValueMode } from '../../types';
import { DataTransformerID } from './ids';
import { ReducerID, fieldReducers } from '../fieldReducer';
import { getFieldMatcher } from '../matchers';
import { FieldMatcherID } from '../matchers/ids';
import { RowVector } from '../../vector/RowVector';
import { ArrayVector, BinaryOperationVector, ConstantVector } from '../../vector';
import { doStandardCalcs } from '../fieldReducer';
import { seriesToColumnsTransformer } from './seriesToColumns';
import { getTimeField } from '../../dataframe/processDataFrame';
import defaults from 'lodash/defaults';
import { BinaryOperationID, binaryOperators } from '../../utils/binaryOperators';

export enum CalculateFieldMode {
  ReduceRow = 'reduceRow',
  BinaryOperation = 'binary',
}

interface ReduceOptions {
  include?: string; // Assume all fields
  reducer: ReducerID;
  nullValueMode?: NullValueMode;
}

interface BinaryOptions {
  left: string;
  operator: BinaryOperationID;
  right: string;
}

const defaultReduceOptions: ReduceOptions = {
  reducer: ReducerID.sum,
};

const defaultBinaryOptions: BinaryOptions = {
  left: '',
  operator: BinaryOperationID.Add,
  right: '',
};

export interface CalculateFieldTransformerOptions {
  // True/False or auto
  timeSeries?: boolean;
  mode: CalculateFieldMode; // defaults to 'reduce'

  // Only one should be filled
  reduce?: ReduceOptions;
  binary?: BinaryOptions;

  // Remove other fields
  replaceFields?: boolean;

  // Output field properties
  alias?: string; // The output field name
  // TODO: config?: FieldConfig; or maybe field overrides? since the UI exists
}

type ValuesCreator = (data: DataFrame) => Vector;

export const calculateFieldTransformer: DataTransformerInfo<CalculateFieldTransformerOptions> = {
  id: DataTransformerID.calculateField,
  name: 'Add field from calculation',
  description: 'Use the row values to calculate a new field',
  defaultOptions: {
    mode: CalculateFieldMode.ReduceRow,
    reduce: {
      reducer: ReducerID.sum,
    },
  },
  transformer: options => (data: DataFrame[]) => {
    // Assume timeseries should first be joined by time
    const timeFieldName = findConsistentTimeFieldName(data);

    if (data.length > 1 && timeFieldName && options.timeSeries !== false) {
      data = seriesToColumnsTransformer.transformer({
        byField: timeFieldName,
      })(data);
    }

    const mode = options.mode ?? CalculateFieldMode.ReduceRow;
    let creator: ValuesCreator | undefined = undefined;

    if (mode === CalculateFieldMode.ReduceRow) {
      creator = getReduceRowCreator(defaults(options.reduce, defaultReduceOptions));
    } else if (mode === CalculateFieldMode.BinaryOperation) {
      creator = getBinaryCreator(defaults(options.binary, defaultBinaryOptions));
    }

    // Nothing configured
    if (!creator) {
      return data;
    }

    return data.map(frame => {
      // delegate field creation to the specific function
      const values = creator!(frame);
      if (!values) {
        return frame;
      }

      const field = {
        name: getResultFieldNameForCalculateFieldTransformerOptions(options),
        type: FieldType.number,
        config: {},
        values,
      };
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

function getReduceRowCreator(options: ReduceOptions): ValuesCreator {
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
    for (const field of frame.fields) {
      if (matcher(field)) {
        columns.push(field.values);
      }
    }

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
      const val = reducer(row, ignoreNulls, nullAsZero)[options.reducer];
      vals.push(val);
    }

    return new ArrayVector(vals);
  };
}

function findFieldValuesWithNameOrConstant(frame: DataFrame, name: string): Vector | undefined {
  if (!name) {
    return undefined;
  }

  for (const f of frame.fields) {
    if (f.name === name) {
      return f.values;
    }
  }

  const v = parseFloat(name);
  if (!isNaN(v)) {
    return new ConstantVector(v, frame.length);
  }

  return undefined;
}

function getBinaryCreator(options: BinaryOptions): ValuesCreator {
  const operator = binaryOperators.getIfExists(options.operator);

  return (frame: DataFrame) => {
    const left = findFieldValuesWithNameOrConstant(frame, options.left);
    const right = findFieldValuesWithNameOrConstant(frame, options.right);
    if (!left || !right || !operator) {
      return (undefined as unknown) as Vector;
    }

    return new BinaryOperationVector(left, right, operator.operation);
  };
}

/**
 * Find the name for the time field used in all frames (if one exists)
 */
function findConsistentTimeFieldName(data: DataFrame[]): string | undefined {
  let name: string | undefined = undefined;
  for (const frame of data) {
    const { timeField } = getTimeField(frame);
    if (!timeField) {
      return undefined; // Not timeseries
    }
    if (!name) {
      name = timeField.name;
    } else if (name !== timeField.name) {
      // Second frame has a different time column?!
      return undefined;
    }
  }
  return name;
}

export function getResultFieldNameForCalculateFieldTransformerOptions(options: CalculateFieldTransformerOptions) {
  if (options.alias?.length) {
    return options.alias;
  }

  if (options.mode === CalculateFieldMode.BinaryOperation) {
    const { binary } = options;
    return `${binary?.left ?? ''} ${binary?.operator ?? ''} ${binary?.right ?? ''}`;
  }

  if (options.mode === CalculateFieldMode.ReduceRow) {
    const r = fieldReducers.getIfExists(options.reduce?.reducer);
    if (r) {
      return r.name;
    }
  }

  return 'math';
}
