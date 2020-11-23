import {
  DataFrame,
  FieldType,
  getTimeField,
  ArrayVector,
  NullValueMode,
  getFieldDisplayName,
  Field,
} from '@grafana/data';
import { AlignedFrameWithGapTest } from '../uPlot/types';
import uPlot, { AlignedData, AlignedDataWithGapTest } from 'uplot';

/**
 * Returns a single DataFrame with:
 * - A shared time column
 * - only numeric fields
 *
 * The input expects all frames to have a time field with values in ascending order
 *
 * @alpha
 */
export function mergeTimeSeriesData(frames: DataFrame[]): AlignedFrameWithGapTest | null {
  const valuesFromFrames: AlignedData[] = [];
  const sourceFields: Field[] = [];

  for (const frame of frames) {
    const { timeField } = getTimeField(frame);
    if (!timeField) {
      continue;
    }

    const alignedData: AlignedData = [
      timeField.values.toArray(), // The x axis (time)
    ];

    // find numeric fields
    for (const field of frame.fields) {
      if (field.type !== FieldType.number) {
        continue;
      }

      let values = field.values.toArray();
      if (field.config.nullValueMode === NullValueMode.AsZero) {
        values = values.map(v => (v === null ? 0 : v));
      }
      alignedData.push(values);

      // Add the first time field
      if (sourceFields.length < 1) {
        sourceFields.push(timeField);
      }

      // This will cache an appropriate field name in the field state
      getFieldDisplayName(field, frame, frames);
      sourceFields.push(field);
    }

    // Timeseries has tima and at least one number
    if (alignedData.length > 1) {
      valuesFromFrames.push(alignedData);
    }
  }

  if (valuesFromFrames.length === 0) {
    return null;
  }

  // do the actual alignment (outerJoin on the first arrays)
  const { data: alignedData, isGap } = outerJoinValues(valuesFromFrames);

  if (alignedData!.length !== sourceFields.length) {
    throw new Error('outerJoinValues lost a field?');
  }

  // Replace the values from the outer-join field
  return {
    frame: {
      length: alignedData![0].length,
      fields: alignedData!.map((vals, idx) => ({
        ...sourceFields[idx],
        values: new ArrayVector(vals),
      })),
    },
    isGap,
  };
}

export function outerJoinValues(tables: AlignedData[]): AlignedDataWithGapTest {
  if (tables.length === 1) {
    return {
      data: tables[0],
      isGap: () => true,
    };
  }

  let xVals: Set<number> = new Set();
  let xNulls: Array<Set<number>> = [new Set()];

  for (const t of tables) {
    let xs = t[0];
    let len = xs.length;
    let nulls: Set<number> = new Set();

    for (let i = 0; i < len; i++) {
      xVals.add(xs[i]);
    }

    for (let j = 1; j < t.length; j++) {
      let ys = t[j];

      for (let i = 0; i < len; i++) {
        if (ys[i] == null) {
          nulls.add(xs[i]);
        }
      }
    }

    xNulls.push(nulls);
  }

  let data: AlignedData = [Array.from(xVals).sort((a, b) => a - b)];

  let alignedLen = data[0].length;

  let xIdxs = new Map();

  for (let i = 0; i < alignedLen; i++) {
    xIdxs.set(data[0][i], i);
  }

  for (const t of tables) {
    let xs = t[0];

    for (let j = 1; j < t.length; j++) {
      let ys = t[j];

      let yVals = Array(alignedLen).fill(null);

      for (let i = 0; i < ys.length; i++) {
        yVals[xIdxs.get(xs[i])] = ys[i];
      }

      data.push(yVals);
    }
  }

  return {
    data: data,
    isGap(u: uPlot, seriesIdx: number, dataIdx: number) {
      // u.data has to be AlignedDate
      let xVal = u.data[0][dataIdx];
      return xNulls[seriesIdx].has(xVal!);
    },
  };
}
