import intersect from 'fast_array_intersect';

import { getTimeField, sortDataFrame } from '../../dataframe';
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
    options.nullMode ?? ((field: Field) => (field.config.custom?.spanNulls === true ? NULL_REMOVE : NULL_EXPAND));

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
  // store frame field order for tabular data join
  const originalFieldsOrderByFrame: number[][] = [];
  // all other fields that are not the join on are in the 1+ position (join is always the 0)
  let fieldsOrder = 1;
  const joinFieldMatcher = getJoinMatcher(options);

  for (let frameIndex = 0; frameIndex < options.frames.length; frameIndex++) {
    const frame = options.frames[frameIndex];

    if (!frame || !frame.fields?.length) {
      continue; // skip the frame
    }

    const nullModesFrame: JoinNullMode[] = [NULL_REMOVE];
    let join: Field | undefined = undefined;
    let fields: Field[] = [];
    let frameFieldsOrder = [];

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
          } else {
            labels = { ...labels, name: frame.name };
          }
        }

        fields.push({
          ...field,
          name,
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
    const a: AlignedData = [join.values]; //

    for (const field of fields) {
      a.push(field.values);
      originalFields.push(field);
      if (!options.keepDisplayNames) {
        // clear field displayName state
        delete field.state?.displayName;
      }
      // store frame field order for tabular data join
      frameFieldsOrder.push(fieldsOrder);
      fieldsOrder++;
    }
    // store frame field order for tabular data join
    originalFieldsOrderByFrame.push(frameFieldsOrder);
    allData.push(a);
  }

  let joined: Array<Array<number | string | null | undefined>> = [];

  if (options.mode === JoinMode.outerTabular) {
    joined = joinOuterTabular(allData, originalFieldsOrderByFrame, originalFields.length, nullModes);
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

// The following full outer join allows for multiple/duplicated joined fields values where as the performant join from uplot creates a unique set of field values to be joined on
// http://www.silota.com/docs/recipes/sql-join-tutorial-javascript-examples.html
// The frame field value which is used join on is sorted to the 0 position of each table data in both tables and nullModes
// (not sure if we need nullModes) for nullModes, the field to join on is given NULL_REMOVE and all other fields are given NULL_EXPAND
function joinOuterTabular(
  tables: AlignedData[],
  originalFieldsOrderByFrame: number[][],
  numberOfFields: number,
  nullModes?: number[][]
) {
  // we will iterate through all frames and check frames for matches preventing duplicates.
  // we will store each matched frame "row" or field values at the same index in the following hash.
  let duplicateHash: { [key: string]: Array<number | string | null | undefined> } = {};

  // iterate through the tables (frames)
  // for each frame we get the field data where the data in the 0 pos is the value to join on
  for (let tableIdx = 0; tableIdx < tables.length; tableIdx++) {
    // the table (frame) to check for matches in other tables
    let table = tables[tableIdx];
    // the field value to join on (the join value is always in the 0 position)
    let joinOnTableField = table[0];

    // now we iterate through the other table (frame) data to look for matches
    for (let otherTablesIdx = 0; otherTablesIdx < tables.length; otherTablesIdx++) {
      // do not match on the same table
      if (otherTablesIdx === tableIdx) {
        continue;
      }

      let otherTable = tables[otherTablesIdx];
      let otherTableJoinOnField = otherTable[0];

      // iterate through the field to join on from the first table
      for (
        let joinTableFieldValuesIdx = 0;
        joinTableFieldValuesIdx < joinOnTableField.length;
        joinTableFieldValuesIdx++
      ) {
        // create the joined data
        // this has the orignalFields length and should start out undefined
        // joined row + number of other fields in each frame
        // the order of each field is important in how we
        // 1 check for duplicates
        // 2 transform the row back into fields for the joined frame
        // 3 when there is no match for the row we keep the vals undefined
        const tableJoinOnValue = joinOnTableField[joinTableFieldValuesIdx];
        const allOtherFields = numberOfFields - 1;
        let joinedRow: Array<number | string | null | undefined> = [tableJoinOnValue].concat(new Array(allOtherFields));

        let tableFieldValIdx = 0;
        for (let fieldsIdx = 1; fieldsIdx < table.length; fieldsIdx++) {
          const joinRowIdx = originalFieldsOrderByFrame[tableIdx][tableFieldValIdx];
          joinedRow[joinRowIdx] = table[fieldsIdx][joinTableFieldValuesIdx];
          tableFieldValIdx++;
        }

        for (let otherTableValuesIdx = 0; otherTableValuesIdx < otherTableJoinOnField.length; otherTableValuesIdx++) {
          if (joinOnTableField[joinTableFieldValuesIdx] === otherTableJoinOnField[otherTableValuesIdx]) {
            let tableFieldValIdx = 0;
            for (let fieldsIdx = 1; fieldsIdx < otherTable.length; fieldsIdx++) {
              const joinRowIdx = originalFieldsOrderByFrame[otherTablesIdx][tableFieldValIdx];
              joinedRow[joinRowIdx] = otherTable[fieldsIdx][otherTableValuesIdx];
              tableFieldValIdx++;
            }

            break;
          }
        }

        // prevent duplicates by entering rows in a hash where keys are the rows
        duplicateHash[JSON.stringify(joinedRow)] = joinedRow;
      }
    }
  }

  // transform the joined rows into data for a dataframe
  let data: Array<Array<number | string | null | undefined>> = [];
  for (let field = 0; field < numberOfFields; field++) {
    data.push(new Array(0));
  }

  for (let key in duplicateHash) {
    const row = duplicateHash[key];

    for (let valIdx = 0; valIdx < row.length; valIdx++) {
      data[valIdx].push(row[valIdx]);
    }
  }

  return data;
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

// nullModes is a tables-matched array indicating how to treat nulls in each series
export function join(tables: AlignedData[], nullModes?: number[][], mode: JoinMode = JoinMode.outer) {
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
export function isLikelyAscendingVector(data: any[], samples = 50) {
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
      if (v <= prevVal) {
        return false;
      }

      prevVal = v;
    }
  }

  return true;
}
