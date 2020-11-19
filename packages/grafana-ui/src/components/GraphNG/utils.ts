import { DataFrame, FieldType, getTimeField, ArrayVector } from '@grafana/data';
import { AlignedDataWithGapTest, AlignedFrameWithGapTest } from '../uPlot/types';
import uPlot, { AlignedData } from 'uplot';

// very time oriented for now
export function mergeDataFrames(frames: DataFrame[]): AlignedFrameWithGapTest | null {
  let valuesFromFrames: AlignedData[] = [];

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];

    let { timeField } = getTimeField(frame);

    // walk all temporal frames
    if (timeField !== undefined && frame.fields.length > 1) {
      // push time values
      let alignedData: AlignedData = [timeField.values.toArray()];

      // push numeric values
      for (let j = 0; j < frame.fields.length; j++) {
        const field = frame.fields[j];

        if (field.type === FieldType.number) {
          let values = field.values.toArray();

          if (field.config.custom?.nullValues === 'asZero') {
            values = values.map(v => (v === null ? 0 : v));
          }

          alignedData.push(values);
        }
      }

      valuesFromFrames.push(alignedData);
    }
  }

  if (valuesFromFrames.length === 0) {
    return null;
  }

  // do the actual alignment (outerJoin on the first arrays)
  let { data: alignedData, isGap } = outerJoinValues(valuesFromFrames);

  // the outerJoined frame we're gonna poop out
  let alignedFrame: DataFrame = {
    name: '<multiple>',
    refId: '<multiple>',
    fields: [],
    length: alignedData[0].length,
  };

  // populate the alignedFrame with original Fields but with aligned values
  for (let i = 0, seriesIdx = 0; i < frames.length; i++) {
    const frame = frames[i];

    let { timeField } = getTimeField(frame);

    // walk all temporal frames
    if (timeField !== undefined && frame.fields.length > 1) {
      // push time field
      if (alignedFrame.fields.length === 0) {
        alignedFrame.fields.push({ ...timeField, values: new ArrayVector(alignedData[seriesIdx++] as any) });
      }

      // push numeric fields
      for (let j = 0; j < frame.fields.length; j++) {
        const field = frame.fields[j];

        if (field.type === FieldType.number) {
          alignedFrame.fields.push({ ...field, values: new ArrayVector(alignedData[seriesIdx++] as any) });
        }
      }

      valuesFromFrames.push(alignedData);
    }
  }

  return {
    frame: alignedFrame,
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

  tables.forEach(t => {
    let xs = t[0];
    let len = xs.length;
    let nulls: Set<number> = new Set();

    for (let i = 0; i < len; i++) {
      xVals.add(xs[i]);
    }

    for (let j = 1; j < t.length; j++) {
      let ys = t[j] as number[];

      for (let i = 0; i < len; i++) {
        if (ys[i] == null) {
          nulls.add(xs[i]);
        }
      }
    }

    xNulls.push(nulls);
  });

  let data: AlignedData = [Array.from(xVals).sort((a, b) => a - b)];

  let alignedLen = data[0].length;

  let xIdxs = new Map();

  for (let i = 0; i < alignedLen; i++) {
    xIdxs.set(data[0][i], i);
  }

  tables.forEach(t => {
    let xs = t[0];

    for (let j = 1; j < t.length; j++) {
      let ys = t[j] as number[];

      let yVals = Array(alignedLen).fill(null);

      for (let i = 0; i < ys.length; i++) {
        yVals[xIdxs.get(xs[i])] = ys[i];
      }

      data.push(yVals);
    }
  });

  return {
    data,
    isGap(u: uPlot, seriesIdx: number, dataIdx: number) {
      // u.data has to be AlignedDate
      let xVal = u.data[0][dataIdx];
      return xNulls[seriesIdx].has(xVal!);
    },
  };
}
