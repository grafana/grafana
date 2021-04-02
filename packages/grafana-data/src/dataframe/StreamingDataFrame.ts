import { Field, DataFrame, FieldType } from '../types/dataFrame';
import { QueryResultMeta } from '../types';
import { ArrayVector } from '../vector';
import { DataFrameJSON, decodeFieldValueEntities } from './DataFrameJSON';
import { guessFieldTypeFromValue } from './processDataFrame';

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

  options: StreamingFrameOptions;

  length = 0;
  private timeFieldIndex = -1;

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
        return {
          config: f.config ?? {},
          name: f.name,
          labels: f.labels,
          type: f.type ?? FieldType.other,
          values: oldValues ? oldValues[idx] : new ArrayVector(),
        };
      });

      this.timeFieldIndex = this.fields.findIndex((f) => f.type === FieldType.time);
    }

    if (data && data.values.length && data.values[0].length) {
      const { values, entities } = data;
      if (values.length !== this.fields.length) {
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

          return {
            name,
            type,
            config: {},
            values: new ArrayVector([]),
          };
        });
      }

      if (entities) {
        entities.forEach((ents, i) => {
          if (ents) {
            decodeFieldValueEntities(ents, values[i]);
            // TODO: append replacements to field
          }
        });
      }

      let curValues = this.fields.map((f) => f.values.buffer);

      let appended = circPush(curValues, values, this.options.maxLength, this.timeFieldIndex, this.options.maxDelta);

      appended.forEach((v, i) => {
        this.fields[i].values.buffer = v;
      });

      // Update the frame length
      this.length = appended[0].length;
    }
  }
}
