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

  constructor(frame: DataFrame, opts?: StreamingFrameOptions) {
    this.name = frame.name;
    this.refId = frame.refId;
    this.meta = frame.meta;
    this.options = {
      maxLength: 1000,
      ...opts,
    };

    // Keep the existing fields
    this.fields = frame.fields.map((f) => {
      if (f.values instanceof ArrayVector) {
        return f as Field<any, ArrayVector<any>>;
      }
      return {
        ...f,
        values: new ArrayVector(f.values.toArray()),
      };
    });

    this.timeFieldIndex = this.fields.findIndex((f) => f.type === FieldType.time);
  }

  get length() {
    if (!this.fields.length) {
      return 0;
    }
    return this.fields[0].values.length;
  }

  update(msg: DataFrameJSON) {
    if (msg.schema) {
      // TODO, replace the existing fields
    }

    if (msg.data) {
      const data = msg.data;
      const { values, entities } = data;

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
      const elapsed = Date.now() - this.lastUpdateTime;

      if (elapsed > 5000) {
        if (this.options.maxSeconds && this.timeFieldIndex >= 0) {
          // TODO -- check time length
        }
        if (this.options.maxLength) {
          const delta = this.length - this.options.maxLength;

          if (delta > 0) {
            this.fields.forEach((f) => {
              f.values.buffer = f.values.buffer.slice(delta);
            });
          }
        }
      }

      this.lastUpdateTime = Date.now();
    }
  }
}
