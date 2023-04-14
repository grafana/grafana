import { DataFrame, FieldType, incrRoundDn } from '@grafana/data';

type InsertMode = (prev: number, next: number, threshold: number) => number;

const INSERT_MODES = {
  threshold: (prev: number, next: number, threshold: number) => prev + threshold,
  midpoint: (prev: number, next: number, threshold: number) => (prev + next) / 2,
  // previous time + 1ms to prevent StateTimeline from forward-interpolating prior state
  plusone: (prev: number, next: number, threshold: number) => prev + 1,
};

interface NullInsertOptions {
  frame: DataFrame;
  refFieldName?: string | null;
  refFieldPseudoMax?: number;
  refFieldPseudoMin?: number;
  insertMode?: InsertMode;
}

export function applyNullInsertThreshold(opts: NullInsertOptions): DataFrame {
  if (opts.frame.length === 0) {
    return opts.frame;
  }

  let thorough = true;
  let { frame, refFieldName, refFieldPseudoMax, refFieldPseudoMin, insertMode } = opts;

  if (!insertMode) {
    insertMode = INSERT_MODES.threshold;
  }

  const refField = frame.fields.find((field) => {
    // note: getFieldDisplayName() would require full DF[]
    return refFieldName != null ? field.name === refFieldName : field.type === FieldType.time;
  });

  if (refField == null) {
    return frame;
  }

  refField.state = {
    ...refField.state,
    nullThresholdApplied: true,
  };

  const thresholds = frame.fields.map((field) => field.config.custom?.insertNulls ?? refField.config.interval ?? null);

  const uniqueThresholds = new Set<number>(thresholds);

  uniqueThresholds.delete(null as any);

  if (uniqueThresholds.size === 0) {
    return frame;
  }

  if (uniqueThresholds.size === 1) {
    const threshold = uniqueThresholds.values().next().value;

    if (threshold <= 0) {
      return frame;
    }

    const refValues = refField.values;

    const frameValues = frame.fields.map((field) => field.values);

    const filledFieldValues = nullInsertThreshold(
      refValues,
      frameValues,
      threshold,
      refFieldPseudoMin,
      refFieldPseudoMax,
      insertMode,
      thorough
    );

    if (filledFieldValues === frameValues) {
      return frame;
    }

    return {
      ...frame,
      length: filledFieldValues[0].length,
      fields: frame.fields.map((field, i) => ({
        ...field,
        values: filledFieldValues[i],
      })),
    };
  }

  // TODO: unique threshold-per-field (via overrides) is unimplemented
  // should be done by processing each (refField + thresholdA-field1 + thresholdA-field2...)
  // as a separate nullInsertThreshold() dataset, then re-join into single dataset via join()
  return frame;
}

function nullInsertThreshold(
  refValues: number[],
  frameValues: any[][],
  threshold: number,
  refFieldPseudoMin: number | null = null,
  // will insert a trailing null when refFieldPseudoMax > last datapoint + threshold
  refFieldPseudoMax: number | null = null,
  getInsertValue: InsertMode,
  // will insert the value at every missing interval
  thorough: boolean
) {
  const len = refValues.length;
  const refValuesNew: number[] = [];

  // Continiuously subtract the threshold from the first data
  // point filling in insert values accordingly
  if (refFieldPseudoMin != null && refFieldPseudoMin < refValues[0]) {
    // this will be 0 or 1 threshold increment left of visible range
    let prevSlot = incrRoundDn(refFieldPseudoMin, threshold);

    while (prevSlot < refValues[0]) {
      // (prevSlot - threshold) is used to simulate the previous 'real' data point, as getInsertValue expects
      refValuesNew.push(getInsertValue(prevSlot - threshold, prevSlot, threshold));
      prevSlot += threshold;
    }
  }

  // Insert initial value
  refValuesNew.push(refValues[0]);

  let prevValue: number = refValues[0];

  // Fill nulls when a value is greater than
  // the threshold value
  for (let i = 1; i < len; i++) {
    const curValue = refValues[i];

    while (curValue - prevValue > threshold) {
      refValuesNew.push(getInsertValue(prevValue, curValue, threshold));

      prevValue += threshold;

      if (!thorough) {
        break;
      }
    }

    refValuesNew.push(curValue);

    prevValue = curValue;
  }

  // At the end of the sequence
  if (refFieldPseudoMax != null && refFieldPseudoMax > prevValue) {
    while (prevValue + threshold < refFieldPseudoMax) {
      refValuesNew.push(getInsertValue(prevValue, refFieldPseudoMax, threshold));
      prevValue += threshold;
    }
  }

  const filledLen = refValuesNew.length;

  if (filledLen === len) {
    return frameValues;
  }

  const filledFieldValues: any[][] = [];

  for (let fieldValues of frameValues) {
    let filledValues;

    if (fieldValues !== refValues) {
      filledValues = Array(filledLen);

      for (let i = 0, j = 0; i < filledLen; i++) {
        filledValues[i] = refValues[j] === refValuesNew[i] ? fieldValues[j++] : null;
      }
    } else {
      filledValues = refValuesNew;
    }

    filledFieldValues.push(filledValues);
  }

  return filledFieldValues;
}
