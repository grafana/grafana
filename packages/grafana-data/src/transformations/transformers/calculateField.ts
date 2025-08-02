import { defaults } from 'lodash';
import { map } from 'rxjs/operators';

import { getTimeField } from '../../dataframe/processDataFrame';
import { getFieldDisplayName } from '../../field/fieldState';
import { ScopedVars } from '../../types/ScopedVars';
import { NullValueMode } from '../../types/data';
import { DataFrame, FieldType, Field } from '../../types/dataFrame';
import { DataTransformContext, DataTransformerInfo } from '../../types/transformations';
import { BinaryOperationID, binaryOperators } from '../../utils/binaryOperators';
import { UnaryOperationID, unaryOperators } from '../../utils/unaryOperators';
import { doStandardCalcs, fieldReducers, ReducerID } from '../fieldReducer';
import { getFieldMatcher } from '../matchers';
import { FieldMatcherID } from '../matchers/ids';

import { ensureColumnsTransformer } from './ensureColumns';
import { DataTransformerID } from './ids';
import { noopTransformer } from './noop';

export enum CalculateFieldMode {
  ReduceRow = 'reduceRow',
  CumulativeFunctions = 'cumulativeFunctions',
  WindowFunctions = 'windowFunctions',
  BinaryOperation = 'binary',
  UnaryOperation = 'unary',
  Index = 'index',
  TemplateExpression = 'templateExpression',
}

export enum WindowSizeMode {
  Percentage = 'percentage',
  Fixed = 'fixed',
}

export enum WindowAlignment {
  Trailing = 'trailing',
  Centered = 'centered',
}

export interface ReduceOptions {
  include?: string[]; // Assume all fields
  reducer: ReducerID;
  nullValueMode?: NullValueMode;
}

export interface CumulativeOptions {
  field?: string;
  reducer: ReducerID;
}

export interface WindowOptions extends CumulativeOptions {
  windowSize?: number;
  windowSizeMode?: WindowSizeMode;
  windowAlignment?: WindowAlignment;
}

export interface UnaryOptions {
  operator: UnaryOperationID;
  fieldName: string;
}

export interface BinaryOptions {
  left: BinaryValue;
  operator: BinaryOperationID;
  right: BinaryValue;
}

export interface BinaryValue {
  fixed?: string;
  matcher?: { id?: FieldMatcherID; options?: string };
}

interface IndexOptions {
  asPercentile: boolean;
}

interface TemplateExpressionOptions {
  expression: string;
  replaceFn: Function;
}

const defaultReduceOptions: ReduceOptions = {
  reducer: ReducerID.sum,
};

export const defaultWindowOptions: WindowOptions = {
  reducer: ReducerID.mean,
  windowAlignment: WindowAlignment.Trailing,
  windowSizeMode: WindowSizeMode.Percentage,
  windowSize: 0.1,
};

const defaultBinaryOptions: BinaryOptions = {
  left: { fixed: '' },
  operator: BinaryOperationID.Add,
  right: { fixed: '' },
};

const defaultUnaryOptions: UnaryOptions = {
  operator: UnaryOperationID.Abs,
  fieldName: '',
};

export interface CalculateFieldTransformerOptions {
  // True/False or auto
  timeSeries?: boolean;
  mode: CalculateFieldMode; // defaults to 'reduce'

  // Only one should be filled
  reduce?: ReduceOptions;
  window?: WindowOptions;
  cumulative?: CumulativeOptions;
  binary?: BinaryOptions;
  unary?: UnaryOptions;
  index?: IndexOptions;
  template?: TemplateExpressionOptions;

  // Remove other fields
  replaceFields?: boolean;

  // Output field properties
  alias?: string; // The output field name
  // TODO: config?: FieldConfig; or maybe field overrides? since the UI exists
  returnType?: FieldType;
}

type ValuesCreator = (data: DataFrame) => unknown[] | undefined;

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
  operator: (options, ctx) => (outerSource) => {
    const mode = options.mode ?? CalculateFieldMode.ReduceRow;

    const asTimeSeries = options.timeSeries !== false;

    const right = options.binary?.right;
    const rightVal = typeof right === 'string' ? right : typeof right === 'object' ? right.fixed : undefined;
    const isBinaryFixed = mode === CalculateFieldMode.BinaryOperation && !Number.isNaN(Number(rightVal));

    const needsSingleFrame = asTimeSeries && !isBinaryFixed;

    const operator = needsSingleFrame
      ? ensureColumnsTransformer.operator(null, ctx)
      : noopTransformer.operator({}, ctx);

    return outerSource.pipe(
      operator,
      map((data) => {
        let creator: ValuesCreator | undefined = undefined;

        switch (mode) {
          case CalculateFieldMode.ReduceRow:
            creator = getReduceRowCreator(defaults(options.reduce, defaultReduceOptions), data);
            break;
          case CalculateFieldMode.CumulativeFunctions:
            creator = getCumulativeCreator(defaults(options.cumulative, defaultReduceOptions), data);
            break;
          case CalculateFieldMode.WindowFunctions:
            creator = getWindowCreator(defaults(options.window, defaultWindowOptions), data);
            break;
          case CalculateFieldMode.UnaryOperation:
            creator = getUnaryCreator(defaults(options.unary, defaultUnaryOptions), data);
            break;
          case CalculateFieldMode.BinaryOperation:
            const fieldNames: string[] = [];
            data.map((frame) => {
              frame.fields.map((field) => {
                fieldNames.push(field.name);
              });
            });
            const binaryOptions = {
              left: checkBinaryValueType(options.binary?.left ?? '', fieldNames),
              operator: options.binary?.operator ?? defaultBinaryOptions.operator,
              right: checkBinaryValueType(options.binary?.right ?? '', fieldNames),
            };
            options.binary = binaryOptions;
            if (binaryOptions.left?.matcher?.id && binaryOptions.left?.matcher.id === FieldMatcherID.byType) {
              const fieldType = binaryOptions.left.matcher.options;
              const operator = binaryOperators.getIfExists(binaryOptions.operator);
              const outFrames = data.map((frame) => {
                const { timeField } = getTimeField(frame);
                const newFields: Field[] = [];
                let didAddNewFields = false;
                if (timeField && options.timeSeries !== false) {
                  newFields.push(timeField);
                }
                // For each field of type match, apply operator
                frame.fields.map((field, index) => {
                  if (!options.replaceFields && !newFields.includes(field)) {
                    newFields.push(field);
                  }
                  if (field.type === fieldType) {
                    const left = field.values;
                    // TODO consolidate common creator logic
                    const right = findFieldValuesWithNameOrConstant(
                      frame,
                      binaryOptions.right ?? defaultBinaryOptions.right,
                      data,
                      ctx
                    );
                    if (!left || !right || !operator) {
                      return undefined;
                    }

                    const arr = new Array(left.length);
                    for (let i = 0; i < arr.length; i++) {
                      arr[i] = operator.operation(left[i], right[i]);
                    }
                    const newField = {
                      ...field,
                      name: `${field.name} ${options.binary?.operator ?? ''} ${options.binary?.right.matcher?.options ?? options.binary?.right.fixed}`,
                      values: arr,
                    };
                    delete newField.state;
                    newFields.push(newField);
                    didAddNewFields = true;
                  }
                });

                if (options.replaceFields && !didAddNewFields) {
                  return undefined;
                }

                return { ...frame, fields: newFields };
              });

              return outFrames.filter((frame) => frame != null);
            } else {
              creator = getBinaryCreator(defaults(binaryOptions, defaultBinaryOptions), data, ctx);
            }
            break;
          case CalculateFieldMode.Index:
            return data.map((frame) => {
              const indexArr = [...Array(frame.length).keys()];

              if (options.index?.asPercentile) {
                for (let i = 0; i < indexArr.length; i++) {
                  indexArr[i] = indexArr[i] / indexArr.length;
                }
              }

              const f = {
                name: options.alias ?? 'Row',
                type: FieldType.number,
                values: indexArr,
                config: options.index?.asPercentile ? { unit: 'percentunit' } : {},
              };
              return {
                ...frame,
                fields: options.replaceFields ? [f] : [...frame.fields, f],
              };
            });
          case CalculateFieldMode.TemplateExpression:
            if (options.template?.expression !== undefined) {
              return data.map((frame) => {
                const newFieldVals = Array.from({ length: frame.length }, (_, i) => {
                  const fieldVars: ScopedVars = {};
                  frame.fields.forEach((field) => {
                    fieldVars[field.name] = {
                      value: field.values[i],
                    };
                  });
                  const replaced = ctx.interpolate(options.template!.expression, fieldVars);
                  return replaced;
                });
                const f: Field = {
                  name: options.alias ?? 'Field',
                  type: FieldType.string,
                  values: newFieldVals,
                  config: {},
                };
                return {
                  ...frame,
                  fields: options.replaceFields ? [f] : [...frame.fields, f],
                };
              });
            } else {
              return data;
            }
        }

        // Nothing configured
        if (!creator) {
          return data;
        }

        const outFrames = data.map((frame) => {
          // delegate field creation to the specific function
          const values = creator!(frame);
          if (!values) {
            // if nothing was done to frame, omit it when replacing fields
            if (options.replaceFields) {
              return undefined;
            }
            return frame;
          }

          const field: Field = {
            name: getNameFromOptions(options),
            type: options.returnType ?? FieldType.number,
            config: {},
            values,
          };

          if (options.alias?.length) {
            // this prevents downstream auto-renames when there is an explicit alias
            field.config.displayName = options.alias;
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
        return outFrames.filter((frame) => frame != null);
      })
    );
  },
};

function getWindowCreator(options: WindowOptions, allFrames: DataFrame[]): ValuesCreator {
  if (options.windowSize! <= 0) {
    throw new Error('Add field from calculation transformation - Window size must be larger than 0');
  }

  let matcher = getFieldMatcher({
    id: FieldMatcherID.numeric,
  });

  if (options.field) {
    matcher = getFieldMatcher({
      id: FieldMatcherID.byNames,
      options: {
        names: [options.field],
      },
    });
  }

  return (frame: DataFrame) => {
    const window = Math.ceil(
      options.windowSize! * (options.windowSizeMode === WindowSizeMode.Percentage ? frame.length : 1)
    );

    // Find the columns that should be examined
    let selectedField: Field | null = null;
    for (const field of frame.fields) {
      if (matcher(field, frame, allFrames)) {
        selectedField = field;
        break;
      }
    }

    if (!selectedField) {
      return;
    }

    if (![ReducerID.mean, ReducerID.stdDev, ReducerID.variance].includes(options.reducer)) {
      throw new Error(`Add field from calculation transformation - Unsupported reducer: ${options.reducer}`);
    }

    if (options.windowAlignment === WindowAlignment.Centered) {
      return getCenteredWindowValues(frame, options.reducer, selectedField, window);
    } else {
      return getTrailingWindowValues(frame, options.reducer, selectedField, window);
    }
  };
}

function getTrailingWindowValues(frame: DataFrame, reducer: ReducerID, selectedField: Field, window: number) {
  const vals: number[] = [];
  let sum = 0;
  let count = 0;
  for (let i = 0; i < frame.length; i++) {
    if (reducer === ReducerID.mean) {
      const currentValue = selectedField.values[i];
      if (currentValue !== null && currentValue !== undefined) {
        count++;
        sum += currentValue;

        if (i > window - 1) {
          const value = selectedField.values[i - window];
          if (value != null) {
            sum -= value;
            count--;
          }
        }
      }
      vals.push(count === 0 ? 0 : sum / count);
    } else if (reducer === ReducerID.variance) {
      const start = Math.max(0, i - window + 1);
      const end = i + 1;
      vals.push(calculateVariance(selectedField.values.slice(start, end)));
    } else if (reducer === ReducerID.stdDev) {
      const start = Math.max(0, i - window + 1);
      const end = i + 1;
      vals.push(calculateStdDev(selectedField.values.slice(start, end)));
    }
  }
  return vals;
}

function getCenteredWindowValues(frame: DataFrame, reducer: ReducerID, selectedField: Field, window: number) {
  const vals: number[] = [];
  let sum = 0;
  let count = 0;
  // Current value (i) is included in the leading part of the window. Which means if the window size is odd,
  // the leading part of the window will be larger than the trailing part.
  const leadingPartOfWindow = Math.ceil(window / 2) - 1;
  const trailingPartOfWindow = Math.floor(window / 2);
  for (let i = 0; i < frame.length; i++) {
    const first = i - trailingPartOfWindow;
    const last = i + leadingPartOfWindow;
    if (reducer === ReducerID.mean) {
      if (i === 0) {
        // We're at the start and need to prime the leading part of the window
        for (let x = 0; x < leadingPartOfWindow + 1 && x < selectedField.values.length; x++) {
          if (selectedField.values[x] != null) {
            sum += selectedField.values[x];
            count++;
          }
        }
      } else {
        if (last < selectedField.values.length) {
          // Last is inside the data and should be added.
          if (selectedField.values[last] != null) {
            sum += selectedField.values[last];
            count++;
          }
        }
        if (first > 0) {
          // Remove values that have fallen outside of the window, if the start of the window isn't outside of the data.
          if (selectedField.values[first - 1] != null) {
            sum -= selectedField.values[first - 1];
            count--;
          }
        }
      }
      vals.push(count === 0 ? 0 : sum / count);
    } else if (reducer === ReducerID.variance) {
      const windowVals = selectedField.values.slice(
        Math.max(0, first),
        Math.min(last + 1, selectedField.values.length)
      );
      vals.push(calculateVariance(windowVals));
    } else if (reducer === ReducerID.stdDev) {
      const windowVals = selectedField.values.slice(
        Math.max(0, first),
        Math.min(last + 1, selectedField.values.length)
      );
      vals.push(calculateStdDev(windowVals));
    }
  }
  return vals;
}

function calculateVariance(vals: number[]): number {
  if (vals.length < 1) {
    return 0;
  }
  let squareSum = 0;
  let runningMean = 0;
  let nonNullCount = 0;
  for (let i = 0; i < vals.length; i++) {
    const currentValue = vals[i];
    if (currentValue != null) {
      nonNullCount++;
      let _oldMean = runningMean;
      runningMean += (currentValue - _oldMean) / nonNullCount;
      squareSum += (currentValue - _oldMean) * (currentValue - runningMean);
    }
  }
  if (nonNullCount === 0) {
    return 0;
  }
  const variance = squareSum / nonNullCount;
  return variance;
}

function calculateStdDev(vals: number[]): number {
  return Math.sqrt(calculateVariance(vals));
}

function getCumulativeCreator(options: CumulativeOptions, allFrames: DataFrame[]): ValuesCreator {
  let matcher = getFieldMatcher({
    id: FieldMatcherID.numeric,
  });

  if (options.field) {
    matcher = getFieldMatcher({
      id: FieldMatcherID.byNames,
      options: {
        names: [options.field],
      },
    });
  }

  if (![ReducerID.mean, ReducerID.sum].includes(options.reducer)) {
    throw new Error(`Add field from calculation transformation - Unsupported reducer: ${options.reducer}`);
  }

  return (frame: DataFrame) => {
    // Find the columns that should be examined
    let selectedField: Field | null = null;
    for (const field of frame.fields) {
      if (matcher(field, frame, allFrames)) {
        selectedField = field;
        break;
      }
    }

    if (!selectedField) {
      return;
    }

    const vals: number[] = [];

    let total = 0;
    for (let i = 0; i < frame.length; i++) {
      total += selectedField.values[i] ?? 0;
      if (options.reducer === ReducerID.sum) {
        vals.push(total);
      } else if (options.reducer === ReducerID.mean) {
        vals.push(total / (i + 1));
      }
    }

    return vals;
  };
}

function getReduceRowCreator(options: ReduceOptions, allFrames: DataFrame[]): ValuesCreator {
  let matcher = getFieldMatcher({
    id: FieldMatcherID.numeric,
  });

  if (options.include && options.include.length) {
    matcher = getFieldMatcher({
      id: FieldMatcherID.byNames,
      options: {
        names: options.include,
      },
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
    const columns = [];
    for (const field of frame.fields) {
      if (matcher(field, frame, allFrames)) {
        columns.push(field.values);
      }
    }

    // Prepare a "fake" field for the row
    const size = columns.length;
    const row: Field = {
      name: 'temp',
      values: new Array(size),
      type: FieldType.number,
      config: {},
    };
    const vals: number[] = [];

    for (let i = 0; i < frame.length; i++) {
      for (let j = 0; j < size; j++) {
        row.values[j] = columns[j][i];
      }

      vals.push(reducer(row, ignoreNulls, nullAsZero)[options.reducer]);
    }

    return vals;
  };
}

function findFieldValuesWithNameOrConstant(
  frame: DataFrame,
  value: BinaryValue,
  allFrames: DataFrame[],
  ctx: DataTransformContext
): number[] | undefined {
  if (!value) {
    return undefined;
  }

  if (value.matcher && value.matcher.id === FieldMatcherID.byName) {
    const name = value.matcher.options ?? '';

    for (const f of frame.fields) {
      if (name === getFieldDisplayName(f, frame, allFrames)) {
        if (f.type === FieldType.boolean) {
          return f.values.map((v) => (v ? 1 : 0));
        }
        return f.values;
      }
    }
  }

  const v = parseFloat(value.fixed ?? value.matcher?.options ?? '');
  if (!isNaN(v)) {
    return new Array(frame.length).fill(v);
  }

  return undefined;
}

function getBinaryCreator(options: BinaryOptions, allFrames: DataFrame[], ctx: DataTransformContext): ValuesCreator {
  const operator = binaryOperators.getIfExists(options.operator);

  return (frame: DataFrame) => {
    const left = findFieldValuesWithNameOrConstant(frame, options.left, allFrames, ctx);
    const right = findFieldValuesWithNameOrConstant(frame, options.right, allFrames, ctx);
    if (!left || !right || !operator) {
      return undefined;
    }

    const arr = new Array(left.length);
    for (let i = 0; i < arr.length; i++) {
      arr[i] = operator.operation(left[i], right[i]);
    }
    return arr;
  };
}

export function checkBinaryValueType(value: BinaryValue | string, names: string[]): BinaryValue {
  // Support old binary value structure
  if (typeof value === 'string') {
    if (isNaN(Number(value))) {
      return { matcher: { id: FieldMatcherID.byName, options: value } };
    } else {
      // If it's a number, check if matches name, otherwise store as fixed number value
      if (names.includes(value)) {
        return { matcher: { id: FieldMatcherID.byName, options: value } };
      } else {
        return { fixed: value };
      }
    }
  }
  // Pass through new BinaryValue structure
  return value;
}

function getUnaryCreator(options: UnaryOptions, allFrames: DataFrame[]): ValuesCreator {
  const operator = unaryOperators.getIfExists(options.operator);

  return (frame: DataFrame) => {
    let value: number[] = [];

    for (const f of frame.fields) {
      if (options.fieldName === getFieldDisplayName(f, frame, allFrames) && f.type === FieldType.number) {
        value = f.values;
      }
    }

    if (!value.length || !operator) {
      return undefined;
    }

    const arr = new Array(value.length);

    let sum = 0;

    if (options.operator === UnaryOperationID.Percent) {
      for (let i = 0; i < value.length; i++) {
        if (Number.isFinite(value[i])) {
          sum += value[i];
        }
      }
    }

    for (let i = 0; i < arr.length; i++) {
      arr[i] = operator.operation(value[i], sum);
    }

    return arr;
  };
}

export function getNameFromOptions(options: CalculateFieldTransformerOptions) {
  if (options.alias?.length) {
    return options.alias;
  }

  switch (options.mode) {
    case CalculateFieldMode.CumulativeFunctions: {
      const { cumulative } = options;
      return `cumulative ${cumulative?.reducer ?? ''}${cumulative?.field ? `(${cumulative.field})` : ''}`;
    }
    case CalculateFieldMode.WindowFunctions: {
      const { window } = options;
      return `${window?.windowAlignment ?? ''} moving ${window?.reducer ?? ''}${
        window?.field ? `(${window.field})` : ''
      }`;
    }
    case CalculateFieldMode.UnaryOperation: {
      const { unary } = options;
      return `${unary?.operator ?? ''}${unary?.fieldName ? `(${unary.fieldName})` : ''}`;
    }
    case CalculateFieldMode.BinaryOperation: {
      const { binary } = options;
      const alias = `${binary?.left?.matcher?.options ?? binary?.left?.fixed ?? ''} ${binary?.operator ?? ''} ${binary?.right?.matcher?.options ?? binary?.right?.fixed ?? ''}`;

      // binary calculations with variables will be interpolated on the visualization but we don't want to do that here, so just give a blank placeholder
      const variableFound = /\$/g.test(alias);
      return variableFound ? '' : alias;
    }
    case CalculateFieldMode.ReduceRow:
      {
        const r = fieldReducers.getIfExists(options.reduce?.reducer);
        if (r) {
          return r.name;
        }
      }
      break;
    case CalculateFieldMode.Index:
      return 'Row';
    case CalculateFieldMode.TemplateExpression:
      return 'Field';
  }

  return 'math';
}
