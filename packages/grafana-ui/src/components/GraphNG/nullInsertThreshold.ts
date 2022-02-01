import { ArrayVector, DataFrame, FieldType } from '@grafana/data';

const INSERT_MODES = {
  threshold: (prev: number, next: number, threshold: number) => prev + threshold,
  midpoint: (prev: number, next: number, threshold: number) => (prev + next) / 2,
  // previous time + 1ms to prevent StateTimeline from forward-interpolating prior state
  plusone: (prev: number, next: number, threshold: number) => prev + 1,
};

type InsertMode = keyof typeof INSERT_MODES;

export function nullInsertThreshold(
  frame: DataFrame,
  threshold?: number | null,
  refFieldName?: string | null,
  insertMode: InsertMode = 'threshold'
): DataFrame {
  if (frame.length < 2) {
    return frame;
  }

  const refField = frame.fields.find((field) => {
    // note: getFieldDisplayName() would require full DF[]
    return refFieldName != null ? field.name === refFieldName : field.type === FieldType.time;
  });

  if (refField == null) {
    return frame;
  }

  const getInsertValue = INSERT_MODES[insertMode];

  if (threshold == null) {
    threshold = refField.config.interval ?? 0;
  }

  if (threshold <= 0) {
    return frame;
  }

  const refValues = refField.values.toArray();
  const len = refValues.length;

  let prevValue: number = refValues[0];
  const refValuesNew: number[] = [prevValue];

  for (let i = 1; i < len; i++) {
    const curValue = refValues[i];

    if (curValue - prevValue > threshold) {
      refValuesNew.push(getInsertValue(prevValue, curValue, threshold));
    }

    refValuesNew.push(curValue);

    prevValue = curValue;
  }

  const filledLen = refValuesNew.length;

  if (filledLen === len) {
    return frame;
  }

  const filledFieldValues: any[][] = [];

  for (let field of frame.fields) {
    let filledValues;

    if (field !== refField) {
      filledValues = Array(filledLen);

      const fieldValues = field.values.toArray();

      for (let i = 0, j = 0; i < filledLen; i++) {
        filledValues[i] = refValues[j] === refValuesNew[i] ? fieldValues[j++] : null;
      }
    } else {
      filledValues = refValuesNew;
    }

    filledFieldValues.push(filledValues);
  }

  const outFrame: DataFrame = {
    ...frame,
    length: filledLen,
    fields: frame.fields.map((field, i) => ({
      ...field,
      values: new ArrayVector(filledFieldValues[i]),
    })),
  };

  return outFrame;
}
