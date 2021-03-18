import { Field, DataFrame, FieldType } from '../types/dataFrame';
import { QueryResultMeta } from '../types';
import { ArrayVector } from '../vector';
import { DataFrameJSON, decodeFieldValueEntities } from './DataFrameJSON';

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
  private lastUpdateTime = 0;
  private timeFieldIndex = -1;

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

      this.timeFieldIndex = this.fields.findIndex((f) => f.type === FieldType.time);
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
        f.values.buffer.push(...values[i]);
      });

      // Shorten the array less frequently than we append
      const now = Date.now();
      const elapsed = now - this.lastUpdateTime;
      if (elapsed > 5000) {
        if (this.options.maxSeconds && this.timeFieldIndex >= 0 && this.length > 2) {
          // TODO -- check time length
          const tf = this.fields[this.timeFieldIndex].values.buffer;
          const elapsed = tf[tf.length - 1] - tf[0];
          console.log('Check elapsed time: ', elapsed);
        }
        if (this.options.maxLength) {
          const delta = this.length - this.options.maxLength;

          if (delta > 0) {
            this.fields.forEach((f) => {
              f.values.buffer = f.values.buffer.slice(delta);
            });
          }
        }
        this.lastUpdateTime = now;
      }
    }
  }
}
