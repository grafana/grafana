import { Field, FieldType, DataFrame, Vector, FieldDTO, DataFrameDTO } from '../types/dataFrame';
import { Labels, QueryResultMeta, KeyValue } from '../types/data';
import { guessFieldTypeForField, guessFieldTypeFromValue, toDataFrameDTO } from './processDataFrame';
import { ArrayVector, AppendingVector, vectorToArray } from './vector';
import isArray from 'lodash/isArray';

export class DataFrameHelper implements DataFrame {
  refId?: string;
  meta?: QueryResultMeta;
  name?: string;
  fields: Field[];
  labels?: Labels;
  length = 0; // updated so it is the length of all fields

  private fieldByName: { [key: string]: Field } = {};
  private fieldByType: { [key: string]: Field[] } = {};

  constructor(data?: DataFrame | DataFrameDTO) {
    if (!data) {
      data = { fields: [] }; //
    }
    this.refId = data.refId;
    this.meta = data.meta;
    this.name = data.name;
    this.labels = data.labels;
    this.fields = [];
    for (let i = 0; i < data.fields.length; i++) {
      this.addField(data.fields[i]);
    }
  }

  addFieldFor(value: any, name?: string): Field {
    if (!name) {
      name = `Field ${this.fields.length + 1}`;
    }
    return this.addField({
      name,
      type: guessFieldTypeFromValue(value),
    });
  }

  /**
   * Reverse the direction of all fields
   */
  reverse() {
    for (const f of this.fields) {
      f.values.toArray().reverse();
    }
  }

  private updateTypeIndex(field: Field) {
    // Make sure it has a type
    if (field.type === FieldType.other) {
      const t = guessFieldTypeForField(field);
      if (t) {
        field.type = t;
      }
    }
    if (!this.fieldByType[field.type]) {
      this.fieldByType[field.type] = [];
    }
    this.fieldByType[field.type].push(field);
  }

  addField(f: Field | FieldDTO): Field {
    const type = f.type || FieldType.other;
    const values =
      !f.values || isArray(f.values)
        ? new ArrayVector(f.values as any[] | undefined) // array or empty
        : (f.values as Vector);

    // And a name
    let name = f.name;
    if (!name) {
      if (type === FieldType.time) {
        name = `Time ${this.fields.length + 1}`;
      } else {
        name = `Column ${this.fields.length + 1}`;
      }
    }
    const field: Field = {
      name,
      type,
      config: f.config || {},
      values,
    };
    this.updateTypeIndex(field);

    if (this.fieldByName[field.name]) {
      console.warn('Duplicate field names in DataFrame: ', field.name);
    } else {
      this.fieldByName[field.name] = field;
    }

    // Make sure the lengths all match
    if (field.values.length !== this.length) {
      if (field.values.length > this.length) {
        // Add `null` to all other values
        const newlen = field.values.length;
        for (const fx of this.fields) {
          const arr = fx.values as ArrayVector;
          while (fx.values.length !== newlen) {
            arr.buffer.push(null);
          }
        }
        this.length = field.values.length;
      } else {
        const arr = field.values as ArrayVector;
        while (field.values.length !== this.length) {
          arr.buffer.push(null);
        }
      }
    }

    this.fields.push(field);
    return field;
  }

  /**
   * This will add each value to the corresponding column
   */
  appendRow(row: any[]) {
    for (let i = this.fields.length; i < row.length; i++) {
      this.addFieldFor(row[i]);
    }

    // The first line may change the field types
    if (this.length < 1) {
      this.fieldByType = {};
      for (let i = 0; i < this.fields.length; i++) {
        const f = this.fields[i];
        if (!f.type || f.type === FieldType.other) {
          f.type = guessFieldTypeFromValue(row[i]);
        }
        this.updateTypeIndex(f);
      }
    }

    for (let i = 0; i < this.fields.length; i++) {
      const f = this.fields[i];
      let v = row[i];
      if (!f.parse) {
        f.parse = makeFieldParser(v, f);
      }
      v = f.parse(v);

      const arr = f.values as ArrayVector;
      arr.buffer.push(v); // may be undefined
    }
    this.length++;
  }

  /**
   * Add any values that match the field names
   */
  appendRowFrom(obj: { [key: string]: any }) {
    for (const f of this.fields) {
      const v = obj[f.name];
      if (!f.parse) {
        f.parse = makeFieldParser(v, f);
      }

      const arr = f.values as ArrayVector;
      arr.buffer.push(f.parse(v)); // may be undefined
    }
    this.length++;
  }

  getFields(type?: FieldType): Field[] {
    if (!type) {
      return [...this.fields]; // All fields
    }
    const fields = this.fieldByType[type];
    if (fields) {
      return [...fields];
    }
    return [];
  }

  hasFieldOfType(type: FieldType): boolean {
    const types = this.fieldByType[type];
    return types && types.length > 0;
  }

  getFirstFieldOfType(type: FieldType): Field | undefined {
    const arr = this.fieldByType[type];
    if (arr && arr.length > 0) {
      return arr[0];
    }
    return undefined;
  }

  hasFieldNamed(name: string): boolean {
    return !!this.fieldByName[name];
  }

  /**
   * Returns the first field with the given name.
   */
  getFieldByName(name: string): Field | undefined {
    return this.fieldByName[name];
  }

  toJSON() {
    return toDataFrameDTO(this);
  }
}

function makeFieldParser(value: string, field: Field): (value: string) => any {
  if (!field.type) {
    if (field.name === 'time' || field.name === 'Time') {
      field.type = FieldType.time;
    } else {
      field.type = guessFieldTypeFromValue(value);
    }
  }

  if (field.type === FieldType.number) {
    return (value: string) => {
      return parseFloat(value);
    };
  }

  // Will convert anything that starts with "T" to true
  if (field.type === FieldType.boolean) {
    return (value: string) => {
      return !(value[0] === 'F' || value[0] === 'f' || value[0] === '0');
    };
  }

  // Just pass the string back
  return (value: string) => value;
}

interface AppendingDataFrameOptions {
  frame?: DataFrame | DataFrameDTO;
  newVector?: (buffer?: any[]) => AppendingVector;
}

export type AppendingField<T = any> = Field<T, AppendingVector<T>>;

export class AppendingDataFrame<T = any> implements DataFrame, AppendingVector<T> {
  name?: string;
  labels?: Labels;
  refId?: string;
  meta?: QueryResultMeta;

  fields: AppendingField[] = [];
  values: KeyValue<AppendingVector> = {};

  private first: Vector = new ArrayVector();
  private newVector: (buffer?: any[]) => AppendingVector;

  constructor(options?: AppendingDataFrameOptions) {
    options = options || {};

    this.newVector = options.newVector
      ? options.newVector
      : (buffer?: any[]) => {
          return new ArrayVector(buffer);
        };
    if (options.frame) {
      const frame = options.frame;
      this.name = frame.name;
      this.labels = frame.labels;
      this.refId = frame.refId;
      this.meta = frame.meta;

      if (frame.fields) {
        for (const f of frame.fields) {
          this.addField(f);
        }
      }
    }
  }

  // Defined for Vector interface
  get length() {
    return this.first.length;
  }

  private addField(f: Field | FieldDTO) {
    let buffer: any[] | undefined = undefined;
    if (f.values) {
      if (isArray(f.values)) {
        buffer = f.values as any[];
      } else {
        buffer = (f.values as Vector).toArray();
      }
    }
    let type = f.type;
    if (!type && buffer && buffer.length) {
      type = guessFieldTypeFromValue(buffer[0]);
    }
    if (!type) {
      type = FieldType.other;
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
    if (this.values[name]) {
      return;
    }

    const field: AppendingField = {
      name,
      type,
      config: f.config || {},
      values: this.newVector(buffer),
    };
    this.values[name] = field.values;
    this.fields.push(field);
    this.first = this.fields[0].values;

    // Make sure all arrays are the same length
    const length = this.fields.reduce((v: number, f) => {
      return Math.max(v, f.values.length);
    }, 0);
    for (const field of this.fields) {
      while (field.values.length !== length) {
        field.values.add(undefined);
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
   * Add all properties of the value as fields on the frame
   */
  add(value: T, addMissingFields?: boolean) {
    if (addMissingFields) {
      this.addMissingFieldsFor(value);
    }
    // Will add one value for every field
    const obj = value as any;
    for (const field of this.fields) {
      field.values.add(obj[field.name]);
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

  get(idx: number): T {
    const v: any = {};
    for (const field of this.fields) {
      v[field.name] = field.values.get(idx);
    }
    return v as T;
  }

  toArray(): T[] {
    return vectorToArray(this);
  }

  toJSON() {
    return toDataFrameDTO(this);
  }
}
