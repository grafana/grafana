import { DataFrame, FieldType, ArrayVector } from '../..';

import { map } from 'rxjs/operators';

import { DataTransformerID } from './ids';
import { DataTransformerInfo } from '../../types/transformations';

export interface InsertValuesTransformerOptions {
  // value to insert
  value?: any;
  // field to use for interval or threshold checking
  field?: string;
  // minimum threshold required between adjacent non-null/non-undefined values
  threshold?: number;
}

export const insertValuesTransformer: DataTransformerInfo<InsertValuesTransformerOptions> = {
  id: DataTransformerID.insertValues,
  name: 'Insert Values',
  description: 'Can be used to insert null values between adjacent points spanning a minimum time threshold',
  operator: (options) => (source) => source.pipe(map((dataFrames) => dataFrames.map((f) => insertValues(f, options)))),
};

export function insertValues(frame: DataFrame, opts?: InsertValuesTransformerOptions): DataFrame {
  let { field: refFieldName, threshold, value = null } = opts ?? {};

  if (frame.length < 2) {
    return frame;
  }

  let refField = frame.fields.find((field) => {
    // note: getFieldDisplayName() would require full DF[]
    return refFieldName != null ? field.name === refFieldName : field.type === FieldType.time;
  });

  if (refField == null) {
    return frame;
  }

  if (threshold == null) {
    threshold = refField.config.interval ?? 0;
  }

  if (threshold <= 0) {
    return frame;
  }

  let refValues = refField.values.toArray();
  let len = refValues.length;

  let prevValue: number = refValues[0];
  let refValuesNew: number[] = [prevValue];

  for (let i = 1; i < len; i++) {
    let curValue = refValues[i];

    if (curValue - prevValue > threshold) {
      // insert new value at midpoint
      refValuesNew.push((prevValue + curValue) / 2);
    }

    refValuesNew.push(curValue);

    prevValue = curValue;
  }

  let filledLen = refValuesNew.length;

  let filledFieldValues: any[][] = [];

  for (let field of frame.fields) {
    let filledValues;

    if (field !== refField) {
      filledValues = Array(filledLen);

      let fieldValues = field.values.toArray();

      for (let i = 0, j = 0; i < filledLen; i++) {
        filledValues[i] = refValues[j] === refValuesNew[i] ? fieldValues[j++] : value;
      }
    } else {
      filledValues = refValuesNew;
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
