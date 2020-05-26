import { Field, DataFrame, DataFrameDTO, FieldDTO, FieldType } from '../types/dataFrame';
import { KeyValue, QueryResultMeta } from '../types/data';
import { guessFieldTypeFromValue, guessFieldTypeForField, toDataFrameDTO } from './processDataFrame';
import isArray from 'lodash/isArray';
import isString from 'lodash/isString';
import { makeFieldParser } from '../utils/fieldParser';
import { MutableVector, Vector } from '../types/vector';
import { ArrayVector } from '../vector/ArrayVector';
import { FunctionalVector } from '../vector/FunctionalVector';

export type MutableField<T = any> = Field<T, MutableVector<T>>;

type MutableVectorCreator = (buffer?: any[]) => MutableVector;

export const MISSING_VALUE: any = null;

export class MutableDataFrame<T = any> extends FunctionalVector<T> implements DataFrame, MutableVector<T> {
  name?: string;
  refId?: string;
  meta?: QueryResultMeta;

  fields: MutableField[] = [];
  values: KeyValue<MutableVector> = {};

  private first: Vector = new ArrayVector();
  private creator: MutableVectorCreator;

  constructor(source?: DataFrame | DataFrameDTO, creator?: MutableVectorCreator) {
    super();

    // This creates the underlying storage buffers
    this.creator = creator
      ? creator
      : (buffer?: any[]) => {
          return new ArrayVector(buffer);
        };

    // Copy values from
    if (source) {
      const { name, refId, meta, fields } = source;
      if (name) {
        this.name = name;
      }
      if (refId) {
        this.refId = refId;
      }
      if (meta) {
        this.meta = meta;
      }
      if (fields) {
        for (const f of fields) {
          this.addField(f);
        }
      }
    }

    // Get Length to show up if you use spread
    Object.defineProperty(this, 'length', {
      enumerable: true,
      get: () => {
        return this.first.length;
      },
    });
  }

  // Defined for Vector interface
  get length() {
    return this.first.length;
  }

  addFieldFor(value: any, name?: string): MutableField {
    return this.addField({
      name: name || '', // Will be filled in
      type: guessFieldTypeFromValue(value),
    });
  }

  addField(f: Field | FieldDTO, startLength?: number): MutableField {
    let buffer: any[] | undefined = undefined;

    if (f.values) {
      if (isArray(f.values)) {
        buffer = f.values as any[];
      } else {
        buffer = (f.values as Vector).toArray();
      }
    }

    let type = f.type;

    if (!type && ('time' === f.name || 'Time' === f.name)) {
      type = FieldType.time;
    } else {
      if (!type && buffer && buffer.length) {
        type = guessFieldTypeFromValue(buffer[0]);
      }
      if (!type) {
        type = FieldType.other;
      }
    }

    // Make sure it has a name
    let name = f.name;
    if (!name) {
      if (type === FieldType.time) {
        name = this.values['Time'] ? `Time ${this.fields.length + 1}` : 'Time';
      } else {
        name = `Field ${this.fields.length + 1}`;
      }
    }

    const field: MutableField = {
      name,
      type,
      config: f.config || {},
      values: this.creator(buffer),
      labels: f.labels,
    };

    if (type === FieldType.other) {
      type = guessFieldTypeForField(field);
      if (type) {
        field.type = type;
      }
    }

    this.fields.push(field);
    this.first = this.fields[0].values;

    // The Field Already exists
    if (this.values[name]) {
      console.warn(`Duplicate field names found: ${name}, only the first will be accessible`);
    } else {
      this.values[name] = field.values;
    }

    // Make sure the field starts with a given length
    if (startLength) {
      while (field.values.length < startLength) {
        field.values.add(MISSING_VALUE);
      }
    } else {
      this.validate();
    }

    return field;
  }

  validate() {
    // Make sure all arrays are the same length
    const length = this.fields.reduce((v: number, f) => {
      return Math.max(v, f.values.length);
    }, 0);

    // Add empty elements until everything matches
    for (const field of this.fields) {
      while (field.values.length !== length) {
        field.values.add(MISSING_VALUE);
      }
    }
  }

  private addMissingFieldsFor(value: any) {
    for (const key of Object.keys(value)) {
      if (!this.values[key]) {
        this.addField({
          name: key,
          type: guessFieldTypeFromValue(value[key]),
        });
      }
    }
  }

  /**
   * Reverse all values
   */
  reverse() {
    for (const f of this.fields) {
      f.values.reverse();
    }
  }

  /**
   * This will add each value to the corresponding column
   */
  appendRow(row: any[]) {
    // Add any extra columns
    for (let i = this.fields.length; i < row.length; i++) {
      this.addField({
        name: `Field ${i + 1}`,
        type: guessFieldTypeFromValue(row[i]),
      });
    }

    // The first line may change the field types
    if (this.length < 1) {
      for (let i = 0; i < this.fields.length; i++) {
        const f = this.fields[i];
        if (!f.type || f.type === FieldType.other) {
          f.type = guessFieldTypeFromValue(row[i]);
        }
      }
    }

    for (let i = 0; i < this.fields.length; i++) {
      const f = this.fields[i];
      let v = row[i];
      if (f.type !== FieldType.string && isString(v)) {
        if (!f.parse) {
          f.parse = makeFieldParser(v, f);
        }
        v = f.parse(v);
      }
      f.values.add(v);
    }
  }

  /**
   * Add all properties of the value as fields on the frame
   */
  add(value: T, addMissingFields?: boolean) {
    if (addMissingFields) {
      this.addMissingFieldsFor(value);
    }

    // Will add one value for every field
    const obj = value as any;
    for (const field of this.fields) {
      let val = obj[field.name];

      if (field.type !== FieldType.string && isString(val)) {
        if (!field.parse) {
          field.parse = makeFieldParser(val, field);
        }
        val = field.parse(val);
      }

      if (val === undefined) {
        val = MISSING_VALUE;
      }

      field.values.add(val);
    }
  }

  set(index: number, value: T, addMissingFields?: boolean) {
    if (index > this.length) {
      throw new Error('Unable ot set value beyond current length');
    }

    if (addMissingFields) {
      this.addMissingFieldsFor(value);
    }

    const obj = (value as any) || {};
    for (const field of this.fields) {
      field.values.set(index, obj[field.name]);
    }
  }

  /**
   * Get an object with a property for each field in the DataFrame
   */
  get(idx: number): T {
    const v: any = {};
    for (const field of this.fields) {
      v[field.name] = field.values.get(idx);
    }
    return v as T;
  }

  /**
   * The simplified JSON values used in JSON.stringify()
   */
  toJSON() {
    return toDataFrameDTO(this);
  }
}
