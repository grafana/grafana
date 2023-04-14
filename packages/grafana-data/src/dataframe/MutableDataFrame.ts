import { isString } from 'lodash';

import { QueryResultMeta } from '../types/data';
import { Field, DataFrame, DataFrameDTO, FieldDTO, FieldType } from '../types/dataFrame';
import { makeFieldParser } from '../utils/fieldParser';
import { FunctionalVector } from '../vector/FunctionalVector';

import { guessFieldTypeFromValue, guessFieldTypeForField, toDataFrameDTO } from './processDataFrame';

export type MutableField<T = any> = Field<T>;

type MutableVectorCreator = (buffer?: any[]) => any[];

export const MISSING_VALUE = undefined; // Treated as connected in new graph panel

export class MutableDataFrame<T = any> extends FunctionalVector<T> implements DataFrame {
  name?: string;
  refId?: string;
  meta?: QueryResultMeta;
  fields: MutableField[] = [];

  private first: any[] = [];
  private creator: MutableVectorCreator;

  constructor(source?: DataFrame | DataFrameDTO, creator?: MutableVectorCreator) {
    super();

    // This creates the underlying storage buffers
    this.creator = creator
      ? creator
      : (buffer?: any[]) => {
          return buffer ?? [];
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

  addFieldFor(value: unknown, name?: string): MutableField {
    return this.addField({
      name: name || '', // Will be filled in
      type: guessFieldTypeFromValue(value),
    });
  }

  addField(f: Field | FieldDTO, startLength?: number): MutableField {
    let buffer: any[] | undefined = undefined;

    if (f.values) {
      buffer = f.values;
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
      name = `Field ${this.fields.length + 1}`;
    }

    const field: MutableField = {
      ...f,
      name,
      type,
      config: f.config || {},
      values: this.creator(buffer),
    };

    if (type === FieldType.other) {
      type = guessFieldTypeForField(field);
      if (type) {
        field.type = type;
      }
    }

    this.fields.push(field);
    this.first = this.fields[0].values;

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

  private parsers: Map<Field, (v: string) => any> | undefined = undefined;

  /**
   * @deprecated unclear if this is actually used
   */
  setParser(field: Field, parser: (v: string) => any) {
    if (!this.parsers) {
      this.parsers = new Map<Field, (v: string) => any>();
    }
    this.parsers.set(field, parser);
    return parser;
  }

  private parseValue(field: Field, v: any): any {
    let p = this.parsers?.get(field);
    if (!p) {
      p = this.setParser(field, makeFieldParser(v, field));
    }
    return p(v);
  }

  /**
   * This will add each value to the corresponding column
   */
  appendRow(row: unknown[]) {
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
        v = this.parseValue(f, v);
      }
      f.values.add(v);
    }
  }

  /** support standard array push syntax */
  push(...vals: T[]): number {
    for (const v of vals) {
      this.add(v);
    }
    return this.length;
  }

  reverse() {
    for (const field of this.fields) {
      field.values.reverse();
    }
    return this;
  }

  /**
   * Add values from an object to corresponding fields. Similar to appendRow but does not create new fields.
   */
  add(value: T): void {
    // Will add one value for every field
    const obj = value as any;
    for (const field of this.fields) {
      let val = obj[field.name];

      if (field.type !== FieldType.string && isString(val)) {
        val = this.parseValue(field, val);
      }

      if (val === undefined) {
        val = MISSING_VALUE;
      }

      field.values.add(val);
    }
  }

  set(index: number, value: T) {
    if (index > this.length) {
      throw new Error('Unable to set value beyond current length');
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
      v[field.name] = field.values[idx];
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
