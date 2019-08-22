import { Field, FieldType, DataFrame, Vector, FieldDTO, DataFrameDTO } from '../types/dataFrame';
import { Labels, QueryResultMeta } from '../types/data';
import { guessFieldTypeForField, guessFieldTypeFromValue } from './processDataFrame';
import { ArrayVector } from './vector';
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
