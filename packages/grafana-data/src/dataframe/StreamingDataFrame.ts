import { Field, DataFrame, FieldType } from '../types/dataFrame';
import { Labels, QueryResultMeta } from '../types';
import { ArrayVector } from '../vector';
import { DataFrameJSON, decodeFieldValueEntities, FieldSchema } from './DataFrameJSON';
import { guessFieldTypeFromValue } from './processDataFrame';
import { join } from '../transformations/transformers/joinDataFrames';
import { AlignedData } from 'uplot';

/**
 * @alpha
 */
export interface StreamingFrameOptions {
  maxLength?: number; // 1000
  maxDelta?: number; // how long to keep things
}

enum PushMode {
  wide,
  labels,
  // long
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

  fields: Array<Field<any, ArrayVector<any>>> = [];
  length = 0;

  options: StreamingFrameOptions;

  private schemaFields: FieldSchema[] = [];
  private timeFieldIndex = -1;
  private pushMode = PushMode.wide;

  // current labels
  private labels: Set<string> = new Set();

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
      this.pushMode = PushMode.wide;
      this.timeFieldIndex = schema.fields.findIndex((f) => f.type === FieldType.time);
      if (
        this.timeFieldIndex === 1 &&
        schema.fields[0].name === 'labels' &&
        schema.fields[0].type === FieldType.string
      ) {
        this.pushMode = PushMode.labels;
        this.timeFieldIndex = 0; // after labels are removed!
      }

      const niceSchemaFields = this.pushMode === PushMode.labels ? schema.fields.slice(1) : schema.fields;

      this.refId = schema.refId;
      this.meta = schema.meta;

      if (hasSameStructure(this.schemaFields, niceSchemaFields)) {
        const len = niceSchemaFields.length;
        this.fields.forEach((f, idx) => {
          const sf = niceSchemaFields[idx % len];
          f.config = sf.config ?? {};
          f.labels = sf.labels;
        });
      } else {
        const isWide = this.pushMode === PushMode.wide;
        this.fields = niceSchemaFields.map((f) => {
          return {
            config: f.config ?? {},
            name: f.name,
            labels: f.labels,
            type: f.type ?? FieldType.other,
            // transfer old values by type & name, unless we relied on labels to match fields
            values: isWide
              ? this.fields.find((of) => of.name === f.name && f.type === of.type)?.values ?? new ArrayVector()
              : new ArrayVector(),
          };
        });
      }

      this.schemaFields = niceSchemaFields;
    }

    if (data && data.values.length && data.values[0].length) {
      let { values, entities } = data;

      if (entities) {
        entities.forEach((ents, i) => {
          if (ents) {
            decodeFieldValueEntities(ents, values[i]);
            // TODO: append replacements to field
          }
        });
      }

      if (this.pushMode === PushMode.labels) {
        // augment and transform data to match current schema for standard circPush() path
        const labeledTables = transpose(values);

        // make sure fields are initalized for each label
        for (const label of labeledTables.keys()) {
          if (!this.labels.has(label)) {
            this.addLabel(label);
          }
        }

        // TODO: cache higher up
        let dummyTable = Array(this.schemaFields.length).fill([]);

        let tables: AlignedData[] = [];
        this.labels.forEach((label) => {
          tables.push(labeledTables.get(label) ?? dummyTable);
        });

        values = join(tables);
      }

      if (values.length !== this.fields.length) {
        if (this.fields.length) {
          throw new Error(
            `push message mismatch.  Expected: ${this.fields.length}, recieved: ${values.length} (labels=${
              this.pushMode === PushMode.labels
            })`
          );
        }

        this.fields = values.map((vals, idx) => {
          let name = `Field ${idx}`;
          let type = guessFieldTypeFromValue(vals[0]);
          const isTime = idx === 0 && type === FieldType.number && vals[0] > 1600016688632;
          if (isTime) {
            type = FieldType.time;
            name = 'Time';
          }

          return {
            name,
            type,
            config: {},
            values: new ArrayVector([]),
          };
        });
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

  // adds a set of fields for a new label
  private addLabel(label: string) {
    let labelCount = this.labels.size;

    // parse labels
    const parsedLabels: Labels = {};

    label.split(',').forEach((kv) => {
      const [key, val] = kv.trim().split('=');
      parsedLabels[key] = val;
    });

    if (labelCount === 0) {
      // mutate existing fields and add labels
      this.fields.forEach((f, i) => {
        if (i > 0) {
          f.labels = parsedLabels;
        }
      });
    } else {
      for (let i = 1; i < this.schemaFields.length; i++) {
        let proto = this.schemaFields[i] as Field;

        this.fields.push({
          ...proto,
          config: proto.config ?? {},
          labels: parsedLabels,
          values: new ArrayVector(Array(this.length).fill(undefined)),
        });
      }
    }

    this.labels.add(label);
  }
}

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

  return tables;
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

function hasSameStructure(a: FieldSchema[], b: FieldSchema[]): boolean {
  if (a?.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    const fA = a[i];
    const fB = b[i];
    if (fA.name !== fB.name || fA.type !== fB.type) {
      return false;
    }
  }
  return true;
}
