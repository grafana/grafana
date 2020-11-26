import {
  DataFrame,
  ArrayVector,
  NullValueMode,
  getFieldDisplayName,
  Field,
  fieldMatchers,
  FieldMatcherID,
} from '@grafana/data';
import { AlignedFrameWithGapTest } from '../uPlot/types';
import uPlot, { AlignedData, AlignedDataWithGapTest } from 'uplot';
import { XYFieldMatchers } from './GraphNG';

// the results ofter passing though data
export interface XYDimensionFields {
  x: Field[];
  y: Field[];
}

export function mapDimesions(match: XYFieldMatchers, frame: DataFrame, frames?: DataFrame[]): XYDimensionFields {
  const out: XYDimensionFields = {
    x: [],
    y: [],
  };
  for (const field of frame.fields) {
    if (match.x(field, frame, frames ?? [])) {
      out.x.push(field);
    }
    if (match.y(field, frame, frames ?? [])) {
      out.y.push(field);
    }
  }
  return out;
}

/**
 * Returns a single DataFrame with:
 * - A shared time column
 * - only numeric fields
 *
 * @alpha
 */
export function alignDataFrames(frames: DataFrame[], fields?: XYFieldMatchers): AlignedFrameWithGapTest | null {
  const valuesFromFrames: AlignedData[] = [];
  const sourceFields: Field[] = [];

  // Default to timeseries config
  if (!fields) {
    fields = {
      x: fieldMatchers.get(FieldMatcherID.firstTimeField).get({}),
      y: fieldMatchers.get(FieldMatcherID.numeric).get({}),
    };
  }

  for (const frame of frames) {
    const dims = mapDimesions(fields, frame, frames);
    if (!(dims.x.length && dims.y.length)) {
      continue; // both x and y matched something!
    }

    if (dims.x.length > 1) {
      throw new Error('Only a single x field is supported');
    }

    // Add the first X axis
    if (!sourceFields.length) {
      sourceFields.push(dims.x[0]);
    }

    const alignedData: AlignedData = [
      dims.x[0].values.toArray(), // The x axis (time)
    ];

    // Add the Y values
    for (const field of dims.y) {
      let values = field.values.toArray();
      if (field.config.nullValueMode === NullValueMode.AsZero) {
        values = values.map(v => (v === null ? 0 : v));
      }
      alignedData.push(values);

      // This will cache an appropriate field name in the field state
      getFieldDisplayName(field, frame, frames);
      sourceFields.push(field);
    }

    valuesFromFrames.push(alignedData);
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
