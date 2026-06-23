import { getTimeField, sortDataFrame } from '../../dataframe/processDataFrame';
import { type DataFrame, type Field, FieldType, TIME_SERIES_VALUE_FIELD_NAME } from '../../types/dataFrame';
import { type FieldMatcher } from '../../types/transformations';
import { fieldMatchers } from '../matchers';
import { FieldMatcherID } from '../matchers/ids';

import { JoinMode } from './joinShared';

function pickBestJoinField(data: DataFrame[]): FieldMatcher {
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
   * @internal -- keep any pre-cached state.displayName
   */
  keepDisplayNames?: boolean;

  /**
   * @internal -- Optionally specify how to treat null values
   */
  nullMode?: (field: Field) => JoinNullMode;

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
 * This will return a single frame joined by the first matching field.  When a join field is not specified,
 * the default will use the first time field
 */
export function joinDataFrames(options: JoinOptions): DataFrame | undefined {
  if (!options.frames?.length) {
    return;
  }

  const nullMode =
    options.nullMode ??
    ((field: Field) => {
      let spanNulls = field.config.custom?.spanNulls;
      return spanNulls === true ? NULL_REMOVE : spanNulls === -1 ? NULL_RETAIN : NULL_EXPAND;
    });

  if (options.frames.length === 1) {
    let frame = options.frames[0];
    let frameCopy = frame;

    const joinFieldMatcher = getJoinMatcher(options);
    let joinIndex = frameCopy.fields.findIndex((f) => joinFieldMatcher(f, frameCopy, options.frames));

    if (options.keepOriginIndices) {
      frameCopy = {
        ...frame,
        fields: frame.fields.map((f, fieldIndex) => {
          const copy = { ...f };
          const origin = {
            frameIndex: 0,
            fieldIndex,
          };
          if (copy.state) {
            copy.state.origin = origin;
          } else {
            copy.state = { origin };
          }
          return copy;
        }),
      };

      // Make sure the join field is first
      if (joinIndex > 0) {
        const joinField = frameCopy.fields[joinIndex];
        const fields = frameCopy.fields.filter((f, idx) => idx !== joinIndex);
        fields.unshift(joinField);
        frameCopy.fields = fields;
        joinIndex = 0;
      }
    }

    if (joinIndex >= 0) {
      frameCopy = maybeSortFrame(frameCopy, joinIndex);
    }

    if (options.keep) {
      let fields = frameCopy.fields.filter(
        (f, fieldIdx) => fieldIdx === joinIndex || options.keep!(f, frameCopy, options.frames)
      );

      // mutate already copied frame
      if (frame !== frameCopy) {
        frameCopy.fields = fields;
      } else {
        frameCopy = {
          ...frame,
          fields,
        };
      }
    }

    return frameCopy;
  }

  const nullModes: JoinNullMode[][] = [];
  const allData: AlignedData[] = [];
  const originalFields: Field[] = [];
  const joinFieldMatcher = getJoinMatcher(options);

  for (let frameIndex = 0; frameIndex < options.frames.length; frameIndex++) {
    const frame = options.frames[frameIndex];

    if (!frame || !frame.fields?.length) {
      continue; // skip the frame
    }

    const nullModesFrame: JoinNullMode[] = [NULL_REMOVE];
    let join: Field | undefined = undefined;
    let fields: Field[] = [];

    for (let fieldIndex = 0; fieldIndex < frame.fields.length; fieldIndex++) {
      const field = frame.fields[fieldIndex];
      field.state = field.state || {};

      if (!join && joinFieldMatcher(field, frame, options.frames)) {
        join = field;
      } else {
        if (options.keep && !options.keep(field, frame, options.frames)) {
          continue; // skip field
        }

        // Support the standard graph span nulls field config
        nullModesFrame.push(nullMode(field));

        let labels = field.labels ?? {};
        let name = field.name;
        if (frame.name) {
          if (field.name === TIME_SERIES_VALUE_FIELD_NAME) {
            name = frame.name;
          } else if (labels.name == null) {
            // add the name label from frame
            labels = { ...labels, name: frame.name };
          }
        }

        fields.push({
          ...field,
          name,
          labels,
        });
      }

      if (options.keepOriginIndices) {
        field.state.origin = {
          frameIndex,
          fieldIndex,
        };
      }
    }

    if (!join) {
      continue; // skip the frame
    }

    if (originalFields.length === 0) {
      originalFields.push(join); // first join field
    }

    nullModes.push(nullModesFrame);
    const a: AlignedData = [join.values]; //

    for (const field of fields) {
      a.push(field.values);
      originalFields.push(field);
      if (!options.keepDisplayNames) {
        // clear field displayName state
        delete field.state?.displayName;
      }
    }
    allData.push(a);
  }

  let joined: Array<Array<number | string | null | undefined>> = [];

  if (allData.length === 0) {
    return {
      length: 0,
      fields: originalFields,
    };
  }

  if (options.mode === JoinMode.outerTabular) {
    joined = joinTabular(allData, true);
  } else if (options.mode === JoinMode.inner) {
    joined = joinTabular(allData);
  } else {
    joined = join(allData, nullModes, options.mode);
  }

  return {
    // ...options.data[0], // keep name, meta?
    length: joined[0] ? joined[0].length : 0,
    fields: originalFields.map((f, index) => ({
      ...f,
      values: joined[index],
    })),
  };
}

/**
 * SQL-style join of tables, using the first column in each
 */
function joinTabular(tables: AlignedData[], outer = false) {
  // console.time('joinTabular');

  let ltable = tables[0];
  let lfield = ltable[0];

  // iterate tables, merging right table with left, with the result becoming the new left
  // rinse and repeat for each tables in the array
  for (let ti = 1; ti < tables.length; ti++) {
    let rtable = tables[ti];
    let rfield = rtable[0];

    /**
     * Build an inverted index of the right table's join column like { "foo": [1,2,3], "bar": [7,12], ... }
     * where the keys are unique values and the arrays are indices where these values were found
     */
    // console.time('index right');
    let index: Record<string | number, number[]> = {};

    for (let i = 0; i < rfield.length; i++) {
      let val = rfield[i];

      let idxs = index[val];

      if (idxs == null) {
        idxs = index[val] = [];
      }

      idxs.push(i);
    }
    // console.timeEnd('index right');

    /**
     * Loop over the left table's join column and match each non-null value to the right index,
     * copying the matched ridxs array into new matched list, like [33, [45,79,233]], where first
     * value is left idx and second value is right idxs
     *
     * Also keep track of unmatched or null left values for outer join, since we'll need to include these
     */
    let matchedKeys = new Set();
    let unmatchedLeft = [];
    let unmatchedRight = [];

    // console.time('match left');
    let matched: Array<[lidx: number, ridxs: number[]]> = [];

    // count of total number of output rows, so we can
    // pre-allocate the final array size during materialization
    let count = 0;

    for (let i = 0; i < lfield.length; i++) {
      let v = lfield[i];

      if (v != null) {
        let idxs = index[v];

        if (idxs != null) {
          matched.push([i, idxs]);
          count += idxs.length;
          outer && matchedKeys.add(v);
        } else if (outer) {
          unmatchedLeft.push(i);
        }
      } else if (outer) {
        unmatchedLeft.push(i);
      }
    }
    count += unmatchedLeft.length;
    // console.timeEnd('match left');

    /**
     * For outer joins, also loop over the right index to record unmatched values
     */
    // console.time('unmatched right');
    if (outer) {
      for (let k in index) {
        if (!matchedKeys.has(k)) {
          unmatchedRight.push(...index[k]);
        }
      }
      count += unmatchedRight.length;
    }
    // console.timeEnd('unmatched right');

    /**
     * Now we can use matched, unmatchedLeft, unmatchedRight, ltable, and rtable to assemble the final table.
     *
     * To keep the hot path free of an inner per-column loop (without resorting to runtime codegen, which
     * requires the 'unsafe-eval' CSP directive) we materialize column-major:
     *
     *   1. First flatten the matched/unmatched bookkeeping into a per-output-row source plan. For each output
     *      row we record the source row index in the left and right tables (-1 means "no source", i.e. null-fill).
     *   2. Then fill each output column independently with a single tight, monomorphic loop over the plan. This
     *      keeps reads/writes sequential within one array at a time, which both avoids the per-cell column
     *      dispatch and is friendlier to the cache than scattering writes across every column on each row.
     */
    // console.time('materialize');
    let leftSrc = new Int32Array(count);
    let rightSrc = new Int32Array(count);

    let rowIdx = 0;

    for (let i = 0; i < matched.length; i++) {
      let [lidx, ridxs] = matched[i];

      for (let j = 0; j < ridxs.length; j++, rowIdx++) {
        leftSrc[rowIdx] = lidx;
        rightSrc[rowIdx] = ridxs[j];
      }
    }

    for (let i = 0; i < unmatchedLeft.length; i++, rowIdx++) {
      leftSrc[rowIdx] = unmatchedLeft[i];
      rightSrc[rowIdx] = -1;
    }

    for (let i = 0; i < unmatchedRight.length; i++, rowIdx++) {
      leftSrc[rowIdx] = -1;
      rightSrc[rowIdx] = unmatchedRight[i];
    }

    let joined: Array<Array<number | string | null | undefined>> = [];

    // join column (output col 0): sourced from the left row when present, otherwise from the matched
    // right row. Every output row has exactly one side, so this always resolves to a real value.
    let ljoin = ltable[0];
    let rjoin = rtable[0];
    let joinCol = Array(count);
    for (let r = 0; r < count; r++) {
      let li = leftSrc[r];
      joinCol[r] = li !== -1 ? ljoin[li] : rjoin[rightSrc[r]];
    }
    joined.push(joinCol);

    // remaining left columns: null-filled for unmatched-right rows
    for (let c = 1; c < ltable.length; c++) {
      let src = ltable[c];
      let col = Array(count);
      for (let r = 0; r < count; r++) {
        let li = leftSrc[r];
        col[r] = li !== -1 ? src[li] : null;
      }
      joined.push(col);
    }

    // right columns (skip the join field): null-filled for unmatched-left rows
    for (let c = 1; c < rtable.length; c++) {
      let src = rtable[c];
      let col = Array(count);
      for (let r = 0; r < count; r++) {
        let ri = rightSrc[r];
        col[r] = ri !== -1 ? src[ri] : null;
      }
      joined.push(col);
    }
    // console.timeEnd('materialize');

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    ltable = joined as AlignedData;
    lfield = ltable[0];
  }

  // console.timeEnd('joinTabular');

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return ltable as Array<Array<string | number | null | undefined>>;
}

//--------------------------------------------------------------------------------
// Below here is copied from uplot (MIT License)
// https://github.com/leeoniya/uPlot/blob/master/src/utils.js#L325
// This avoids needing to import uplot into the data package
//--------------------------------------------------------------------------------

// Copied from uplot
type TypedArray =
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
export const NULL_REMOVE = 0; // nulls are converted to undefined (e.g. for spanGaps: true)
export const NULL_RETAIN = 1; // nulls are retained, with alignment artifacts set to undefined (default)
export const NULL_EXPAND = 2; // nulls are expanded to include any adjacent alignment artifacts

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

// test if we can do cheap join (all join fields same)
function allHeadersSame(tables: AlignedData[]) {
  let vals0 = tables[0][0];
  let len0 = vals0.length;

  for (let i = 1; i < tables.length; i++) {
    let vals1 = tables[i][0];

    if (vals1.length !== len0) {
      return false;
    }

    if (vals1 !== vals0) {
      for (let j = 0; j < len0; j++) {
        if (vals1[j] !== vals0[j]) {
          return false;
        }
      }
    }
  }

  return true;
}

// nullModes is a tables-matched array indicating how to treat nulls in each series
export function join(tables: AlignedData[], nullModes?: number[][], mode: JoinMode = JoinMode.outer) {
  // cheap join
  if (allHeadersSame(tables)) {
    let table = tables[0].slice();

    for (let i = 1; i < tables.length; i++) {
      table.push(...tables[i].slice(1));
    }

    let tmpFrame: DataFrame = {
      length: table[0].length,
      fields: table.map((values) => ({
        name: '',
        type: FieldType.number,
        config: {},
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        values: values as number[],
      })),
    };

    return maybeSortFrame(tmpFrame, 0).fields.map((field) => field.values);
  }

  let xVals: Set<number> = new Set();

  for (let ti = 0; ti < tables.length; ti++) {
    let t = tables[ti];
    let xs = t[0];
    let len = xs.length;

    for (let i = 0; i < len; i++) {
      xVals.add(xs[i]);
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
export function isLikelyAscendingVector(data: unknown[], samples = 50) {
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

    if (v != null && prevVal != null) {
      if (v <= prevVal) {
        return false;
      }

      prevVal = v;
    }
  }

  return true;
}
