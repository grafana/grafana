import { Field, DataFrame, FieldType } from '../types/dataFrame';
import { Labels, QueryResultMeta } from '../types';
import { ArrayVector } from '../vector';
import { DataFrameJSON, decodeFieldValueEntities } from './DataFrameJSON';
import { guessFieldTypeFromValue } from './processDataFrame';

// converts vertical insertion records with table keys in [0] and column values in [1...N]
// to join()-able tables with column arrays
export function transpose(vrecs: any[][]) {
  let tableKeys = new Set(vrecs[0]);
  let tables = new Map();

  tableKeys.forEach((key) => {
    let cols = Array(vrecs.length - 1)
      .fill(null)
      .map(() => []);

    tables.set(key, cols);
  });

  for (let r = 0; r < vrecs[0].length; r++) {
    let table = tables.get(vrecs[0][r]);
    for (let c = 1; c < vrecs.length; c++) {
      table[c - 1].push(vrecs[c][r]);
    }
  }

  return [[...tables.keys()], [...tables.values()]];
}

// binary search for index of closest value
function closestIdx(num: number, arr: number[], lo?: number, hi?: number) {
  let mid;
  lo = lo || 0;
  hi = hi || arr.length - 1;
  let bitwise = hi <= 2147483647;

  while (hi - lo > 1) {
    mid = bitwise ? (lo + hi) >> 1 : Math.floor((lo + hi) / 2);

    if (arr[mid] < num) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  if (num - arr[lo] <= arr[hi] - num) {
    return lo;
  }

  return hi;
}

// mutable circular push
function circPush(data: number[][], newData: number[][], maxLength = Infinity, deltaIdx = 0, maxDelta = Infinity) {
  for (let i = 0; i < data.length; i++) {
    data[i] = data[i].concat(newData[i]);
  }

  const nlen = data[0].length;

  let sliceIdx = 0;

  if (nlen > maxLength) {
    sliceIdx = nlen - maxLength;
  }

  if (maxDelta !== Infinity && deltaIdx >= 0) {
    const deltaLookup = data[deltaIdx];

    const low = deltaLookup[sliceIdx];
    const high = deltaLookup[nlen - 1];

    if (high - low > maxDelta) {
      sliceIdx = closestIdx(high - maxDelta, deltaLookup, sliceIdx);
    }
  }

  if (sliceIdx) {
    for (let i = 0; i < data.length; i++) {
      data[i] = data[i].slice(sliceIdx);
    }
  }

  return data;
}

/**
 * @alpha
 */
export interface StreamingFrameOptions {
  maxLength?: number; // 1000
  maxDelta?: number; // how long to keep things
}

/**
 * Unlike a circular buffer, this will append and periodically slice the front
 *
 * @alpha
 */
export class StreamingDataFrame implements DataFrame {
  name?: string;
  refId?: string;
  meta?: QueryResultMeta;

  // raw field buffers
  fields: Array<Field<any, ArrayVector<any>>> = [];
  byKey = new Map<string, Field<any, ArrayVector<any>>>(); // name+labels
  fieldSchemas?: Field[];

  options: StreamingFrameOptions;

  length = 0;
  private timeFieldIndex = -1;
  private labelsFieldIndex = -1;
  private appendFn: (data: any[][]) => void;

  constructor(frame: DataFrameJSON, opts?: StreamingFrameOptions) {
    this.options = {
      maxLength: 1000,
      maxDelta: Infinity,
      ...opts,
    };

    this.appendFn = this.appendTable;
    this.push(frame);
  }

  /**
   * apply the new message to the existing data.  This will replace the existing schema
   * if a new schema is included in the message, or append data matching the current schema
   */
  push(msg: DataFrameJSON) {
    const { schema, data } = msg;
    if (schema) {
      // Keep old values if they are the same shape
      let oldValues: ArrayVector[] | undefined;
      if (schema.fields.length === this.fields.length) {
        let same = true;
        oldValues = this.fields.map((f, idx) => {
          const oldField = this.fields[idx];
          if (f.name !== oldField.name || f.type !== oldField.type) {
            same = false;
          }
          return f.values;
        });
        if (!same) {
          oldValues = undefined;
        }
      }

      this.name = schema.name;
      this.refId = schema.refId;
      this.meta = schema.meta;
      this.byKey.clear();

      // Create new fields from the schema
      this.fields = schema.fields.map((f, idx) => {
        const field = {
          config: f.config ?? {},
          name: f.name,
          labels: f.labels,
          type: f.type ?? FieldType.other,
          values: oldValues ? oldValues[idx] : new ArrayVector(),
        };
        return field;
      });

      this.appendFn = this.appendTable;
      this.timeFieldIndex = this.fields.findIndex((f) => f.type === FieldType.time);
      this.labelsFieldIndex = this.fields.findIndex((f) => f.name === 'labels' && f.type === FieldType.string);
      if (this.labelsFieldIndex > 0) {
        this.fieldSchemas = this.fields;
        if (this.timeFieldIndex < 0) {
          console.error('Label fields require a time index');
          return;
        }
        for (const field of this.fields) {
          if (field.labels) {
            console.log('invalid field, sholud not have labels when labels field exists', field);
          }
          field.labels = undefined;
        }
        this.fields = [this.fields[this.timeFieldIndex]];
        this.timeFieldIndex = 0;
        this.appendFn = this.appendWithLabels;
      }
    }

    if (data && data.values.length && data.values[0].length) {
      const { values, entities } = data;

      // Field length changed
      if (this.labelsFieldIndex >= 0) {
        if (values.length !== this.fieldSchemas!.length) {
          throw new Error(`push message mismatch.  Expected: ${this.fieldSchemas!.length}, recieved: ${values.length}`);
        }
      } else if (values.length !== this.fields.length) {
        if (this.fields.length) {
          throw new Error(`push message mismatch.  Expected: ${this.fields.length}, recieved: ${values.length}`);
        }

        this.byKey.clear();
        this.fields = values.map((vals, idx) => {
          let name = `Field ${idx}`;
          let type = guessFieldTypeFromValue(vals[0]);
          const isTime = idx === 0 && type === FieldType.number && vals[0] > 1600016688632;
          if (isTime) {
            type = FieldType.time;
            name = 'Time';
          }

          const field = {
            name,
            type,
            config: {},
            values: new ArrayVector([]),
          };
          return field;
        });
      }

      if (entities) {
        entities.forEach((ents, i) => {
          if (ents) {
            decodeFieldValueEntities(ents, values[i]);
            // append replacements to field?
          }
        });
      }

      this.appendFn(values);
    }
  }

  /**
   * When the input values is a simple table we can assume
   */
  private appendTable(values: any[][]) {
    let curValues = this.fields.map((f) => f.values.buffer);

    let appended = circPush(curValues, values, this.options.maxLength, this.timeFieldIndex, this.options.maxDelta);

    appended.forEach((v, i) => {
      const { state, values } = this.fields[i];
      values.buffer = v;
      if (state) {
        state.calcs = undefined;
      }
    });

    // Update the frame length
    this.length = appended[0].length;
  }

  private appendWithLabels(values: any[][]) {
    const fields = this.fieldSchemas!;
    const timeValues = values[this.timeFieldIndex];
    const labelValues = values[this.labelsFieldIndex];

    const timeField = this.fields[0]; // always zero
    const indexToValue = new Map<number, any>();

    let lastTime = timeValues[0];
    indexToValue.set(0, lastTime);
    for (let row = 0; row < timeValues.length; row++) {
      const time = timeValues[row];
      if (time !== lastTime) {
        this.appendFieldsByIndex(indexToValue);

        lastTime = time;
        indexToValue.clear();
        indexToValue.set(0, lastTime);
      }

      const labels = labelValues[row] as string; // string
      if (!labels) {
        console.log('No labels row?', row, values);
        continue;
      }
      for (let i = 0; i < fields.length; i++) {
        if (i === this.timeFieldIndex || i === this.labelsFieldIndex) {
          continue;
        }
        const key = fields[i].name + '/' + labels;
        let f = this.byKey.get(key)!;
        if (!f) {
          const parsed: Labels = {};
          labels.split(',').forEach((s) => {
            const [key, val] = s.trim().split('=');
            parsed[key] = val;
          });

          f = {
            ...this.fieldSchemas![i],
            labels: parsed,
            values: new ArrayVector(Array(timeField.values.length).fill(undefined)),
            __index: this.fields.length,
          } as any;
          this.byKey.set(key, f);
          this.fields.push(f);
        }
        indexToValue.set((f as any).__index as number, values[i][row]);
      }
    }

    this.appendFieldsByIndex(indexToValue);
    this.length = this.fields[0].values.buffer.length;

    console.log('DONE', this.name, this.length);
  }

  // Only grows for now!!!!
  private appendFieldsByIndex(indexToValue: Map<number, any>) {
    for (let i = 0; i < this.fields.length; i++) {
      const value = indexToValue.get(i);
      this.fields[i].values.buffer.push(value);
    }
    // console.log('APPEND/Z', this.fields.length, indexToValue);
  }
}
