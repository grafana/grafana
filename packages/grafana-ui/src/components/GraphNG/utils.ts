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
import uPlot, { AlignedData, JoinNullMode } from 'uplot';
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
  const nullModes: JoinNullMode[][] = [];

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

    let nullModesFrame: JoinNullMode[] = [];

    // Add the first X axis
    if (!sourceFields.length) {
      sourceFields.push(dims.x[0]);
      nullModesFrame.push(0);
    }

    const alignedData: AlignedData = [
      dims.x[0].values.toArray(), // The x axis (time)
    ];

    // Add the Y values
    for (const field of dims.y) {
      let values = field.values.toArray();
      let joinNullMode = field.config.custom.spanNulls ? 0 : 2;

      if (field.config.nullValueMode === NullValueMode.AsZero) {
        values = values.map(v => (v === null ? 0 : v));
        joinNullMode = 0;
      }

      alignedData.push(values);
      nullModesFrame.push(joinNullMode);

      // This will cache an appropriate field name in the field state
      getFieldDisplayName(field, frame, frames);
      sourceFields.push(field);
    }

    valuesFromFrames.push(alignedData);
    nullModes.push(nullModesFrame);
  }

  if (valuesFromFrames.length === 0) {
    return null;
  }

  // do the actual alignment (outerJoin on the first arrays)
  let { data: alignedData, isGap } = uPlot.join(valuesFromFrames, nullModes);

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
