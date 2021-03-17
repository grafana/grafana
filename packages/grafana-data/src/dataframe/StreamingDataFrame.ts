import { Field, DataFrame, FieldType } from '../types/dataFrame';
import { QueryResultMeta } from '../types';
import { ArrayVector } from '../vector';
import { DataFrameJSON, decodeFieldValueEntities } from './DataFrameJSON';

// circular push
function circPush(buf: any[], v: any) {
  let blen = buf.length;
  let bend = blen - 1;

  if (Array.isArray(v)) {
    let vlen = v.length;

    buf.copyWithin(0, vlen);

    let j = 0;
    let i = blen - vlen;

    while (i < blen) {
      buf[i++] = v[j++];
    }
  } else {
    buf.copyWithin(0, 1);
    buf[bend] = v;
  }
}

/**
 * @alpha
 */
export interface StreamingFrameOptions {
  maxLength?: number; // 1000
  maxSeconds?: number; // how long to keep things
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

  constructor(frame: DataFrameJSON, opts?: StreamingFrameOptions) {
    this.options = {
      maxLength: 1000,
      ...opts,
    };
    this.update(frame);
  }

  get length() {
    if (!this.fields.length) {
      return 0;
    }
    return this.fields[0].values.length;
  }

  /**
   * apply the new message to the existing data.  This will replace the existing schema
   * if a new schema is included in the message, or append data matching the current schema
   */
  update(msg: DataFrameJSON) {
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
    }

    if (data && data.values.length && data.values[0].length) {
      const { values, entities } = data;
      if (values.length !== this.fields.length) {
        throw new Error('update message mismatch');
      }

      if (entities) {
        entities.forEach((ents, i) => {
          if (ents) {
            decodeFieldValueEntities(ents, values[i]);
            // TODO: append replacements to field
          }
        });
      }

      this.fields.forEach((f, i) => {
        circPush(f.values.buffer, values[i]);
      });
    }
  }
}
