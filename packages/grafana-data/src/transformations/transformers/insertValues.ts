import { DataFrame, FieldType, Field, ArrayVector } from '../..';

import { map } from 'rxjs/operators';

import { DataTransformerID } from './ids';
import { DataTransformerInfo } from '../../types/transformations';

const enum InsertValuesMode {
  Interval = 'interval',
  Threshold = 'threshold',
}

const IS_TIME_FIELD = (field: Field) => field.type === FieldType.time;
const THRESHOLD_HOUR = 3600 * 1e3;

export interface InsertValuesTransformerOptions {
  mode: InsertValuesMode;
  // value to insert
  value: any;
  // finds field to use for interval or threshold checking
  isRefField?: (field: Field) => boolean;
  // minimum threshold required between adjacent non-null/non-undefined values
  threshold?: number;
  // should refField's values be scanned to find minimum interval?
  guessInterval?: boolean;
}

export const insertValuesTransformer: DataTransformerInfo<InsertValuesTransformerOptions> = {
  id: DataTransformerID.insertValues,
  name: 'Insert Values',
  description: 'Can be used to insert null values between adjacent points spanning a minimum time threshold',
  defaultOptions: {
    mode: InsertValuesMode.Interval,
    value: null,
    isRefField: IS_TIME_FIELD,
    guessInterval: false,
  },
  operator: ({ mode, value = null, isRefField = IS_TIME_FIELD, guessInterval = false, threshold = THRESHOLD_HOUR }) => (
    source
  ) =>
    source.pipe(
      map((dataFrames) => {
        if (mode === InsertValuesMode.Interval) {
          return dataFrames.map((f) => insertValuesInterval(f, value ?? null, guessInterval ?? false, isRefField));
        } else {
          return dataFrames.map((f) => insertValuesThreshold(f, value ?? null, threshold, isRefField ?? IS_TIME_FIELD));
        }
      })
    ),
};

// expects ascending number values in refField
function getInterval(refField: Field, guessFromValues = false) {
  let interval = Math.max(refField.config?.interval ?? 0, 0);

  if (interval === 0 && guessFromValues && refField.values.length > 2) {
    let refVals = refField.values.toArray();

    interval = Infinity;

    for (let i = 1; i < refVals.length; i++) {
      interval = Math.min(interval, refVals[i] - refVals[i - 1]);
    }
  }

  return Number.isFinite(interval) ? interval : 0;
}

// assumes some interval steps may be absent, but what remains in the time field:
// 1. contains only numbers, would pass Number.isFinite(value)
// 2. conforms to the specified interval
// 3. is in ascending order
export function insertValuesInterval(
  frame: DataFrame,
  value: any = null,
  guessFromValues = false,
  isRefField = IS_TIME_FIELD
) {
  if (frame.length <= 1) {
    return frame;
  }

  let refField = frame.fields.find(isRefField);

  if (refField == null) {
    return frame;
  }

  let interval = getInterval(refField, guessFromValues);

  if (interval === 0) {
    return frame;
  }

  let refValues = refField.values.toArray();
  let len = refValues.length;
  let minValue = refValues[0];
  let maxValue = refValues[len - 1];
  let filledLen = (maxValue - minValue) / interval + 1;

  // cheap exit length matches expected length
  if (len === filledLen) {
    return frame;
  }

  let filledFieldValues: any[][] = [];

  for (let field of frame.fields) {
    let filledValues = Array(filledLen);

    if (field === refField) {
      for (let i = 0; i < filledLen; i++) {
        filledValues[i] = minValue + i * interval;
      }
    } else {
      let fieldValues = field.values.toArray();

      for (let i = 0, j = 0; i < filledLen; i++) {
        filledValues[i] = refValues[j] === minValue + i * interval ? fieldValues[j++] : value;
      }
    }

    filledFieldValues.push(filledValues);
  }

  let outFrame: DataFrame = {
    ...frame,
    length: filledLen,
    fields: frame.fields.map((field, i) => ({
      ...field,
      values: new ArrayVector(filledFieldValues[i]),
    })),
  };

  return outFrame;
}

// TODO: implement
function insertValuesThreshold(frame: DataFrame, value: any = null, threshold: number, isRefField = IS_TIME_FIELD) {
  return frame;
}
