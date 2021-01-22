import { DataFrame, Field, FieldMatcher, FieldType } from '../../types';
import { ArrayVector } from '../../vector';
import { fieldMatchers } from '../matchers';
import { FieldMatcherID } from '../matchers/ids';
import { getTimeField } from '../../dataframe';
import { getFieldDisplayName } from '../../field';

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

export interface JoinOptions {
  data: DataFrame[];
  joinBy?: FieldMatcher;

  /**
   * @internal -- used when we need to keep a reference to the original frame/field index
   */
  keepOriginIndexes?: boolean;
}

/**
 * This will return a single frame joined by the first matching field.  When a join field is not specified,
 * the default will use the first time field
 */
export function joinDataFrames(options: JoinOptions): DataFrame | undefined {
  if (!options.data.length) {
    return undefined;
  }
  if (options.data.length < 2) {
    return options.data[0];
  }

  const allData: AlignedData[] = [];
  const originalFields: Field[] = [];

  const joinFieldMatcher = options.joinBy ?? pickBestJoinField(options.data);
  for (let frameIndex = 0; frameIndex < options.data.length; frameIndex++) {
    const frame = options.data[frameIndex];
    if (!frame || !frame.fields?.length) {
      continue; // skip the frame
    }

    let join: Field | undefined = undefined;
    let fields: Field[] = [];
    for (let fieldIndex = 0; fieldIndex < frame.fields.length; fieldIndex++) {
      const field = frame.fields[fieldIndex];
      getFieldDisplayName(field, frame, options.data); // caches the name (with frames) in state

      if (!join && joinFieldMatcher(field, frame, options.data)) {
        join = field;
      } else {
        fields.push(field);
      }
      if (options.keepOriginIndexes) {
        field.state!.origin = {
          frameIndex,
          fieldIndex,
        };
      }
    }

    if (!join) {
      continue; // skip the frame
    }

    if (originalFields.length < 1) {
      originalFields.push(join); // first join field
    }

    const a: AlignedData = [join.values.toArray()]; //
    for (const field of fields) {
      a.push(field.values.toArray());
      originalFields.push(field);
    }
    allData.push(a);
  }

  const joined = join(
    allData,
    allData.map((v) => v.map((x) => NULL_EXPAND)) // will show gaps in the timeseries panel
  );
  if (!joined) {
    return undefined;
  }

  return {
    ...options.data[0],
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
type AlignedData = [number[], ...Array<Array<number | null>>];

// nullModes
const NULL_IGNORE = 0; // all nulls are ignored, converted to undefined (e.g. spanGaps: true)
const NULL_GAP = 1; // nulls are retained, alignment artifacts = undefined values (default)
const NULL_EXPAND = 2; // nulls are expanded to include adjacent alignment artifacts (undefined values)

// mark all filler nulls as explicit when adjacent to existing explicit nulls (minesweeper)
function nullExpand(yVals: Array<number | null>, nullIdxs: number[], alignedLen: number) {
  for (let i = 0, xi, lastNullIdx = Number.NEGATIVE_INFINITY; i < nullIdxs.length; i++) {
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
function join(tables: AlignedData[], nullModes: number[][]) {
  if (tables.length === 1) {
    return tables[0];
  }

  let xVals = new Set<number>();

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

      let nullMode = nullModes ? nullModes[ti][si] : NULL_GAP;

      let nullIdxs = [];

      for (let i = 0; i < ys.length; i++) {
        let yVal = ys[i];
        let alignedIdx = xIdxs.get(xs[i]);

        if (yVal == null) {
          if (nullMode !== NULL_IGNORE) {
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
