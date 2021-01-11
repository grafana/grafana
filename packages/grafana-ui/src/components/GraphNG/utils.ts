import {
  DataFrame,
  ArrayVector,
  NullValueMode,
  getFieldDisplayName,
  Field,
  fieldMatchers,
  FieldMatcherID,
  FieldType,
  FieldState,
  DataFrameFieldIndex,
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
  const sourceFieldsRefs: Record<number, DataFrameFieldIndex> = {};
  const nullModes: JoinNullMode[][] = [];

  // Default to timeseries config
  if (!fields) {
    fields = {
      x: fieldMatchers.get(FieldMatcherID.firstTimeField).get({}),
      y: fieldMatchers.get(FieldMatcherID.numeric).get({}),
    };
  }

  for (let frameIndex = 0; frameIndex < frames.length; frameIndex++) {
    const frame = frames[frameIndex];
    const dims = mapDimesions(fields, frame, frames);

    if (!(dims.x.length && dims.y.length)) {
      continue; // no numeric and no time fields
    }

    if (dims.x.length > 1) {
      throw new Error('Only a single x field is supported');
    }

    let nullModesFrame: JoinNullMode[] = [0];

    // Add the first X axis
    if (!sourceFields.length) {
      sourceFields.push(dims.x[0]);
    }

    const alignedData: AlignedData = [
      dims.x[0].values.toArray(), // The x axis (time)
    ];

    for (let fieldIndex = 0; fieldIndex < frame.fields.length; fieldIndex++) {
      const field = frame.fields[fieldIndex];

      if (!fields.y(field, frame, frames)) {
        continue;
      }

      let values = field.values.toArray();
      let joinNullMode = field.config.custom?.spanNulls ? 0 : 2;

      if (field.config.nullValueMode === NullValueMode.AsZero) {
        values = values.map(v => (v === null ? 0 : v));
        joinNullMode = 0;
      }

      sourceFieldsRefs[sourceFields.length] = { frameIndex, fieldIndex };

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

  let seriesIdx = 0;
  // Replace the values from the outer-join field
  return {
    frame: {
      length: alignedData![0].length,
      fields: alignedData!.map((vals, idx) => {
        let state: FieldState = { ...sourceFields[idx].state };

        if (sourceFields[idx].type !== FieldType.time) {
          state.seriesIndex = seriesIdx;
          seriesIdx++;
        }

        return {
          ...sourceFields[idx],
          state,
          values: new ArrayVector(vals),
        };
      }),
    },
    isGap,
    getDataFrameFieldIndex: (alignedFieldIndex: number) => {
      const index = sourceFieldsRefs[alignedFieldIndex];
      if (!index) {
        throw new Error(`Could not find index for ${alignedFieldIndex}`);
      }
      return index;
    },
  };
}
