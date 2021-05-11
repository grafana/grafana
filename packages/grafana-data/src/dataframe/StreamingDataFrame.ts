import { Field, DataFrame, FieldType } from '../types/dataFrame';
import { Labels, QueryResultMeta } from '../types';
import { ArrayVector } from '../vector';
import { DataFrameJSON, DataFrameSchema, decodeFieldValueEntities, FieldSchema } from './DataFrameJSON';
import { guessFieldTypeFromValue } from './processDataFrame';
import { join, AlignedData } from '../transformations/transformers/joinDataFrames';

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
  labels?: LabelFrameInfo;
  timeFieldIndex = -1;

  options: StreamingFrameOptions;
  length = 0;

  constructor(frame: DataFrameJSON, opts?: StreamingFrameOptions) {
    this.options = {
      maxLength: 1000,
      maxDelta: Infinity,
      ...opts,
    };
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

      this.labels = undefined;
      this.timeFieldIndex = this.fields.findIndex((f) => f.type === FieldType.time);
      let labelIndex = this.fields.findIndex((f) => f.name === 'labels' && f.type === FieldType.string);
      if (labelIndex > 0) {
        this.labels = new LabelFrameInfo(schema, labelIndex, this.timeFieldIndex);
      }
    }

    if (data && data.values.length && data.values[0].length) {
      const { values, entities } = data;

      // Field length changed
      if (this.labels) {
        if (values.length !== this.labels.schemaFields.length) {
          throw new Error(
            `push message mismatch.  Expected: ${this.labels.schemaFields.length}, recieved: ${values.length}`
          );
        }
      } else if (values.length !== this.fields.length) {
        if (this.fields.length) {
          throw new Error(`push message mismatch.  Expected: ${this.fields.length}, recieved: ${values.length}`);
        }

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

      this.appendValues(values);
    }
  }

  /**
   * When the input values is a simple table we can assume
   */
  private appendValues(values: any[][]) {
    if (this.labels) {
      values = this.labels.prepare(values);
      this.fields = this.labels.fields;
    }

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
}

class LabelFrameInfo {
  // The original schema
  schemaFields: FieldSchema[]; // eveyrthing except values
  fields: Array<Field<any, ArrayVector<any>>> = [];

  timeFieldIndex = -1;
  labelsFieldIndex = -1;
  valuesIndex: number[] = [];

  knownLabels: string[] = [];

  constructor(schema: DataFrameSchema, labelIndex: number, timeIndex: number) {
    this.schemaFields = schema.fields;

    this.labelsFieldIndex = labelIndex;
    this.timeFieldIndex = timeIndex;
    for (let i = 0; i < schema.fields.length; i++) {
      if (i === this.labelsFieldIndex || i === this.timeFieldIndex) {
        continue;
      }
      this.valuesIndex.push(i);
    }
    this.fields = [
      {
        ...(this.schemaFields[this.timeFieldIndex] as Field),
        config: this.schemaFields[this.timeFieldIndex].config ?? {},
        values: new ArrayVector(),
        type: FieldType.time,
      },
    ];
  }

  prepare(data: any[][]): any[][] {
    const frames = new Map<string, AlignedData>();

    // Split each row into its own frame
    const labels = data[this.labelsFieldIndex];
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i] as string;
      let frame = frames.get(label);
      if (!frame) {
        let offset = this.knownLabels.indexOf(label);
        if (offset < 0) {
          offset = this.knownLabels.length;
          this.knownLabels.push(label);

          const parsed: Labels = {};
          label.split(',').forEach((s) => {
            const [key, val] = s.trim().split('=');
            parsed[key] = val;
          });

          const empty = new Array(this.fields[0].values.length).fill(undefined);
          for (const idx of this.valuesIndex) {
            this.fields.push({
              ...(this.schemaFields[idx] as Field),
              config: this.schemaFields[idx].config ?? {},
              labels: parsed,
              values: new ArrayVector(empty),
            });
          }
        }
        frame = [[], ...this.valuesIndex.map((v) => [])]; // empty frame values
        frames.set(label, frame);
      }
      let j = 0;
      frame[j++].push(data[this.timeFieldIndex][i]);
      for (const idx of this.valuesIndex) {
        frame[j++].push(data[idx][i]);
      }
    }

    // Make a frame for each label set
    const input = this.knownLabels.map((v) => {
      let frame = frames.get(v);
      if (!frame) {
        frame = [[], ...this.valuesIndex.map((v) => [])]; // empty array
      }
      return frame;
    });

    // join the results into a single wide value
    return join(input);
  }
}
