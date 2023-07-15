import intersect from 'fast_array_intersect';

import { getTimeField, sortDataFrame } from '../../dataframe';
import { cacheFieldDisplayNames } from '../../field';
import { DataFrame, Field, FieldMatcher, FieldType, TIME_SERIES_VALUE_FIELD_NAME } from '../../types';
import { fieldMatchers } from '../matchers';
import { FieldMatcherID } from '../matchers/ids';

import { JoinMode } from './joinByField';

export function pickBestJoinField(data: DataFrame[]): FieldMatcher {
  const { timeField } = getTimeField(data[0]);
  if (timeField) {
    return fieldMatchers.get(FieldMatcherID.firstTimeField).get({});
  }
  let common: string[] = [];
  for (const f of data[0].fields) {
    if (f.type === FieldType.number) {
      common.push(f.name);
    }
  }

  for (let i = 1; i < data.length; i++) {
    const names: string[] = [];
    for (const f of data[0].fields) {
      if (f.type === FieldType.number) {
        names.push(f.name);
      }
    }
    common = common.filter((v) => !names.includes(v));
  }

  return fieldMatchers.get(FieldMatcherID.byName).get(common[0]);
}

/**
 * @internal
 */
export interface JoinOptions {
  /**
   * The input fields
   */
  frames: DataFrame[];

  /**
   * The field to join -- frames that do not have this field will be dropped
   */
  joinBy?: FieldMatcher;

  /**
   * Optionally filter the non-join fields
   */
  keep?: FieldMatcher;

  /**
   * @internal -- used when we need to keep a reference to the original frame/field index
   */
  keepOriginIndices?: boolean;

  /**
   * @internal -- Optionally specify a join mode (outer or inner)
   */
  mode?: JoinMode;
}

function getJoinMatcher(options: JoinOptions): FieldMatcher {
  return options.joinBy ?? pickBestJoinField(options.frames);
}

/**
 * @internal
 */
export function maybeSortFrame(frame: DataFrame, fieldIdx: number) {
  if (fieldIdx >= 0) {
    let sortByField = frame.fields[fieldIdx];

    if (sortByField.type !== FieldType.string && !isLikelyAscendingVector(sortByField.values)) {
      frame = sortDataFrame(frame, fieldIdx);
    }
  }

  return frame;
}

/**
 * @internal
 *
 * checks if values of all joinBy fields match and are already sorted
 */
export function canDoCheapOuterJoin(allData: number[][][]) {
  let vals0 = allData[0][0];

  for (let i = 1; i < allData.length; i++) {
    let vals1 = allData[i][0];

    if (vals1.length !== vals0.length) {
      return false;
    }

    for (let j = 0; j < vals0.length; j++) {
      if (vals1[j] !== vals0[j]) {
        return false;
      }
    }
  }

  return true;
}

/**
 * @internal
 *
 */
function copyField(field: Field, frameIndex: number, fieldIndex: number, keepOriginIndices = false) {
  const fieldCopy = { ...field };

  if (keepOriginIndices) {
    fieldCopy.state = {
      ...field.state,
      origin: {
        frameIndex,
        fieldIndex,
      },
    };
  }

  return fieldCopy;
}

/**
 * This will return a single frame joined by the first matching field.  When a join field is not specified,
 * the default will use the first time field
 */
export function joinDataFrames(options: JoinOptions): DataFrame | undefined {
  const { frames, mode = JoinMode.outer, keepOriginIndices = false, keep = () => true } = options;

  if (frames.length === 0) {
    return;
  }

  // cacheFieldDisplayNames(frames);

  const joinFieldMatcher = getJoinMatcher(options);

  const nullModes: JoinNullMode[][] = [];
  const allData: number[][][] = [];
  const allFields: Field[] = [];

  for (let frameIndex = 0; frameIndex < frames.length; frameIndex++) {
    const frame = frames[frameIndex];

    const joinFieldIdx = frame.fields.findIndex((field) => joinFieldMatcher(field, frame, frames));

    if (joinFieldIdx === -1) {
      continue;
    } else if (allFields.length === 0) {
      const copy = copyField(frame.fields[joinFieldIdx], frameIndex, joinFieldIdx, keepOriginIndices);
      allFields.push(copy);
    }

    const nullModesFrame: JoinNullMode[] = [NULL_REMOVE];
    const frameValues: number[][] = [frame.fields[joinFieldIdx].values];

    for (let fieldIndex = 0; fieldIndex < frame.fields.length; fieldIndex++) {
      const field = frame.fields[fieldIndex];

      if (fieldIndex !== joinFieldIdx && keep(field, frame, frames)) {
        const copy = copyField(field, frameIndex, fieldIndex, keepOriginIndices);

        let spanNulls = field.config.custom?.spanNulls;
        nullModesFrame.push(spanNulls === true ? NULL_REMOVE : spanNulls === -1 ? NULL_RETAIN : NULL_EXPAND);

        if (frame.name) {
          if (field.name === TIME_SERIES_VALUE_FIELD_NAME) {
            copy.name = frame.name;
          } else {
            copy.labels = { ...field.labels, name: frame.name };
          }
        }

        frameValues.push(copy.values);
        allFields.push(copy);
      }
    }

    nullModes.push(nullModesFrame);
    allData.push(frameValues);
  }

  let cheap = frames.length === 1 || (mode === JoinMode.outer && canDoCheapOuterJoin(allData));

  let joinedData = cheap
    ? [allData[0][0], ...allData.flatMap((table) => table.slice(1))]
    : join(allData, nullModes, mode);

  let joinedFrame = {
    // ...options.data[0], // keep name, meta?
    length: joinedData[0].length,
    fields: allFields.map((f, index) => ({
      ...f,
      values: joinedData[index],
    })),
  };

  if (cheap) {
    // console.log('cheap!');
    return maybeSortFrame(joinedFrame, 0);
  }

  return joinedFrame;
}

//--------------------------------------------------------------------------------
// Below here is copied from uplot (MIT License)
// https://github.com/leeoniya/uPlot/blob/master/src/utils.js#L325
// This avoids needing to import uplot into the data package
//--------------------------------------------------------------------------------

// Copied from uplot
export type TypedArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Uint8ClampedArray
  | Float32Array
  | Float64Array;

export type AlignedData =
  | TypedArray[]
  | [xValues: number[] | TypedArray, ...yValues: Array<Array<number | null | undefined> | TypedArray>];

// nullModes
const NULL_REMOVE = 0; // nulls are converted to undefined (e.g. for spanGaps: true)
const NULL_RETAIN = 1; // nulls are retained, with alignment artifacts set to undefined (default)
const NULL_EXPAND = 2; // nulls are expanded to include any adjacent alignment artifacts

type JoinNullMode = number; // NULL_IGNORE | NULL_RETAIN | NULL_EXPAND;

// sets undefined values to nulls when adjacent to existing nulls (minesweeper)
function nullExpand(yVals: Array<number | null>, nullIdxs: number[], alignedLen: number) {
  for (let i = 0, xi, lastNullIdx = -1; i < nullIdxs.length; i++) {
    let nullIdx = nullIdxs[i];

    if (nullIdx > lastNullIdx) {
      xi = nullIdx - 1;
      while (xi >= 0 && yVals[xi] == null) {
        yVals[xi--] = null;
      }

      xi = nullIdx + 1;
      while (xi < alignedLen && yVals[xi] == null) {
        yVals[(lastNullIdx = xi++)] = null;
      }
    }
  }
}

// nullModes is a tables-matched array indicating how to treat nulls in each series
export function join(tables: number[][][], nullModes?: number[][], mode: JoinMode = JoinMode.outer) {
  let xVals: Set<number>;

  if (mode === JoinMode.inner) {
    // @ts-ignore
    xVals = new Set(intersect(tables.map((t) => t[0])));
  } else {
    xVals = new Set();

    for (let ti = 0; ti < tables.length; ti++) {
      let t = tables[ti];
      let xs = t[0];
      let len = xs.length;

      for (let i = 0; i < len; i++) {
        xVals.add(xs[i]);
      }
    }
  }

  let data = [Array.from(xVals).sort((a, b) => a - b)];

  let alignedLen = data[0].length;

  let xIdxs = new Map();

  for (let i = 0; i < alignedLen; i++) {
    xIdxs.set(data[0][i], i);
  }

  for (let ti = 0; ti < tables.length; ti++) {
    let t = tables[ti];
    let xs = t[0];

    for (let si = 1; si < t.length; si++) {
      let ys = t[si];

      let yVals = Array(alignedLen).fill(undefined);

      let nullMode = nullModes ? nullModes[ti][si] : NULL_RETAIN;

      let nullIdxs = [];

      for (let i = 0; i < ys.length; i++) {
        let yVal = ys[i];
        let alignedIdx = xIdxs.get(xs[i]);

        if (yVal === null) {
          if (nullMode !== NULL_REMOVE) {
            yVals[alignedIdx] = yVal;

            if (nullMode === NULL_EXPAND) {
              nullIdxs.push(alignedIdx);
            }
          }
        } else {
          yVals[alignedIdx] = yVal;
        }
      }

      nullExpand(yVals, nullIdxs, alignedLen);

      data.push(yVals);
    }
  }

  return data;
}

// Test a few samples to see if the values are ascending
// Only exported for tests
export function isLikelyAscendingVector(data: Array<number | null> | TypedArray, samples = 50) {
  const len = data.length;

  // empty or single value
  if (len <= 1) {
    return true;
  }

  // skip leading & trailing nullish
  let firstIdx = 0;
  let lastIdx = len - 1;

  while (firstIdx <= lastIdx && data[firstIdx] == null) {
    firstIdx++;
  }

  while (lastIdx >= firstIdx && data[lastIdx] == null) {
    lastIdx--;
  }

  // all nullish or one value surrounded by nullish
  if (lastIdx <= firstIdx) {
    return true;
  }

  const stride = Math.max(1, Math.floor((lastIdx - firstIdx + 1) / samples));

  for (let prevVal = data[firstIdx], i = firstIdx + stride; i <= lastIdx; i += stride) {
    const v = data[i];

    if (v != null) {
      if (v <= prevVal!) {
        return false;
      }

      prevVal = v;
    }
  }

  return true;
}
