import { DataFrame, Field, FieldMatcher, FieldType, Vector } from '../../types';
import { ArrayVector } from '../../vector';
import { fieldMatchers } from '../matchers';
import { FieldMatcherID } from '../matchers/ids';
import { getTimeField, sortDataFrame } from '../../dataframe';

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
 * @alpha
 */
export interface JoinOptions {
  /**
   * The input fields
   */
  frames: DataFrame[];

  /**
   * The field to join -- frames that do not have this field will be droppped
   */
  joinBy?: FieldMatcher;

  /**
   * Optionally filter the non-join fields
   */
  keep?: FieldMatcher;

  /**
   * When the result is a single frame, this will to a quick check to see if the values are sorted,
   * and sort if necessary.  If the first/last values are in order the whole vector is assumed to be
   * sorted
   */
  enforceSort?: boolean;

  /**
   * @internal -- used when we need to keep a reference to the original frame/field index
   */
  keepOriginIndices?: boolean;
}

function getJoinMatcher(options: JoinOptions): FieldMatcher {
  return options.joinBy ?? pickBestJoinField(options.frames);
}

/**
 * This will return a single frame joined by the first matching field.  When a join field is not specified,
 * the default will use the first time field
 */
export function outerJoinDataFrames(options: JoinOptions): DataFrame | undefined {
  if (!options.frames?.length) {
    return;
  }

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

    if (options.enforceSort) {
      if (joinIndex >= 0) {
        if (!isLikelyAscendingVector(frameCopy.fields[joinIndex].values)) {
          frameCopy = sortDataFrame(frameCopy, joinIndex);
        }
      }
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
        let spanNulls = field.config.custom?.spanNulls;
        nullModesFrame.push(spanNulls === true ? NULL_REMOVE : spanNulls === -1 ? NULL_RETAIN : NULL_EXPAND);

        let labels = field.labels ?? {};
        if (frame.name) {
          labels = { ...labels, name: frame.name };
        }

        fields.push({
          ...field,
          labels, // add the name label from frame
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
    const a: AlignedData = [join.values.toArray()]; //

    for (const field of fields) {
      a.push(field.values.toArray());
      originalFields.push(field);
      // clear field displayName state
      delete field.state?.displayName;
    }

    allData.push(a);
  }

  const joined = join(allData, nullModes);

  return {
    // ...options.data[0], // keep name, meta?
    length: joined[0].length,
    fields: originalFields.map((f, index) => ({
      ...f,
      values: new ArrayVector(joined[index]),
    })),
  };
}

//--------------------------------------------------------------------------------
// Below here is copied from uplot (MIT License)
// https://github.com/leeoniya/uPlot/blob/master/src/utils.js#L325
// This avoids needing to import uplot into the data package
//--------------------------------------------------------------------------------

// Copied from uplot
export type AlignedData = [number[], ...Array<Array<number | null | undefined>>];

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
export function join(tables: AlignedData[], nullModes?: number[][]) {
  const xVals = new Set<number>();

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

// Quick test if the first and last points look to be ascending
// Only exported for tests
export function isLikelyAscendingVector(data: Vector): boolean {
  let first: any = undefined;

  for (let idx = 0; idx < data.length; idx++) {
    const v = data.get(idx);
    if (v != null) {
      if (first != null) {
        if (first > v) {
          return false; // descending
        }
        break;
      }
      first = v;
    }
  }

  let idx = data.length - 1;
  while (idx >= 0) {
    const v = data.get(idx--);
    if (v != null) {
      if (first > v) {
        return false;
      }
      return true;
    }
  }

  return true; // only one non-null point
}
