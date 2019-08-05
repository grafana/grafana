import { Field, FieldType, DataFrame, Vector } from '../types/dataFrame';
import { Labels, QueryResultMeta, NullValueMode } from '../types/data';
import { guessFieldTypeForField, guessFieldTypeFromValue } from './processDataFrame';
import isNumber from 'lodash/isNumber';
import isString from 'lodash/isString';
import isArray from 'lodash/isArray';
import { FieldCalcs, reduceField } from './fieldReducer';

interface FieldWithCache<T = any> extends Field<T> {
  /**
   * Cache of reduced fields
   */
  stats?: FieldCalcs;

  /**
   * Convert text to the field value
   */
  parse?: (value: any) => T;

  /**
   * TODO: based on config, save the display processor
   */
  process?: (value: T) => {}; // DisplayValue

  /**
   * Return a set of reductions either from the cache or calculated
   */
  reduce: (
    reducers: string[], // The stats to calculate
    nullValueMode?: NullValueMode
  ) => FieldCalcs;
}

export class DataFrameHelper implements DataFrame {
  refId?: string;
  meta?: QueryResultMeta;
  name?: string;
  fields: FieldWithCache[];
  labels?: Labels;

  private longestFieldLength = 0;
  private fieldByName: { [key: string]: FieldWithCache } = {};
  private fieldByType: { [key: string]: FieldWithCache[] } = {};

  constructor(data: DataFrame) {
    this.refId = data.refId;
    this.meta = data.meta;
    this.name = data.name;
    this.labels = data.labels;
    this.fields = [];
    for (let i = 0; i < data.fields.length; i++) {
      this.addField(data.fields[i]);
    }
  }

  /**
   * Returns a copy that does not include functions
   */
  toDataFrame(): DataFrame {
    const fields = this.fields.map(f => {
      return {
        name: f.name,
        type: f.type,
        display: f.display,
        values: f.values,
      };
    });

    return {
      fields,
      refId: this.refId,
      meta: this.meta,
      name: this.name,
      labels: this.labels,
    };
  }

  addFieldFor(value: any, name?: string): FieldWithCache {
    if (!name) {
      name = `Field ${this.fields.length + 1}`;
    }
    return this.addField({
      name,
      type: guessFieldTypeFromValue(value),
      values: [],
    });
  }

  /**
   * Reverse the direction of all fields
   */
  reverse() {
    for (const f of this.fields) {
      if (isArray(f.values)) {
        const arr = f.values as any[];
        arr.reverse();
      }
    }
  }

  /**
   * Remove some of the rows.
   *
   * TODO: really just want a circular buffer
   */
  slice(start?: number, end?: number) {
    let len = 0;
    for (const f of this.fields) {
      const vals = f.values as any[];
      f.values = vals.slice(start, end);
      if (f.values.length > len) {
        len = f.values.length;
      }
    }

    // Should not be necessary
    for (const fx of this.fields) {
      while (fx.values.length < len) {
        fx.values.push(null);
      }
    }
    this.longestFieldLength = len;
  }

  private reduce(
    field: FieldWithCache,
    reducers: string[], // The stats to calculate
    nullValueMode?: NullValueMode
  ): FieldCalcs {
    if (!field.stats) {
      return (field.stats = reduceField({
        field,
        reducers,
        nullValueMode,
      }));
    }

    // Find the values we need to calculate
    const missing: string[] = [];
    for (const s of reducers) {
      if (!field.stats.hasOwnProperty(s)) {
        missing.push(s);
      }
    }
    if (missing.length > 0) {
      // Merge existing with calculated values
      field.stats = {
        ...field.stats,
        ...reduceField({
          field,
          reducers: missing,
          nullValueMode,
        }),
      };
    }
    return field.stats!;
  }

  private updateTypeIndex(field: FieldWithCache) {
    // Make sure it has a type
    if (!field.type) {
      field.type = guessFieldTypeForField(field);
      if (!field.type) {
        field.type = FieldType.other;
      }
    }
    if (!this.fieldByType[field.type!]) {
      this.fieldByType[field.type!] = [];
    }
    this.fieldByType[field.type!].push(field);
  }

  addField(f: Field): FieldWithCache {
    const field = {
      ...f,
      reduce: (
        reducers: string[], // The stats to calculate
        nullValueMode?: NullValueMode
      ): FieldCalcs => {
        return this.reduce(field, reducers, nullValueMode);
      },
    };
    this.updateTypeIndex(field);

    // And a name
    if (!field.name) {
      field.name = `Column ${this.fields.length + 1}`;
    }
    if (this.fieldByName[field.name]) {
      console.warn('Duplicate field names in DataFrame: ', field.name);
    }
    this.fieldByName[field.name] = field;

    // Make sure the lengths all match
    if (field.values.length !== this.length) {
      if (field.values.length > this.length) {
        // Add `null` to all other values
        const newlen = field.values.length;
        for (const fx of this.fields) {
          while (fx.values.length !== newlen) {
            fx.values.push(null);
          }
        }
        this.longestFieldLength = field.values.length;
      } else {
        while (field.values.length !== this.longestFieldLength) {
          field.values.push(null);
        }
      }
    }

    this.fields.push(field);
    return field;
  }

  get length() {
    return this.longestFieldLength;
  }

  /**
   * This will add each value to the corresponding column
   */
  appendRow(row: any[]) {
    for (let i = this.fields.length; i < row.length; i++) {
      this.addFieldFor(row[i]);
    }

    // The first line may change the field types
    if (this.longestFieldLength < 1) {
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
      f.values.push(v); // may be undefined
    }
    this.longestFieldLength++;
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
      f.values.push(f.parse(v)); // may be undefined
    }
    this.longestFieldLength++;
  }

  getFields(type?: FieldType): FieldWithCache[] {
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
    return this.fieldByType[type] && this.fieldByType[type].length > 0;
  }

  getFirstFieldOfType(type: FieldType): FieldWithCache | null {
    const arr = this.fieldByType[type];
    if (arr && arr.length > 0) {
      return arr[0];
    }
    return null;
  }

  hasFieldNamed(name: string): boolean {
    return this.fieldByName[name] !== undefined;
  }

  getFieldByName(name: string): FieldWithCache | null {
    return this.fieldByName[name];
  }

  /**
   * Get each row as a synthetic view
   */
  getValues<T>(): Vector<T> {
    const cursor = new RowCursor(this.fields);
    const rowHandler = {
      get: (data: DataFrameHelper, prop: any) => {
        if ('length' === prop) {
          return data.length;
        }
        const index = asNumber(prop);
        cursor.cursor = index;
        return cursor;
      },
    };

    const proxy = new Proxy(this, rowHandler);
    const v = (proxy as unknown) as Vector<T>;
    v.push = (...items: T[]) => v.length;
    return v;
  }
}

/**
 * This object has a 'get' property for each field name
 * and can be accessed by column index
 */
class RowCursor {
  cursor = 0;

  constructor(private fields: Field[]) {
    for (let i = 0; i < fields.length; i++) {
      const getter = {
        get: () => {
          return this.getFieldValue(i);
        },
      };
      Object.defineProperty(this, fields[i].name, getter);
      Object.defineProperty(this, i, getter);
    }
  }

  getFieldValue(column: number): any {
    return this.fields[column].values[this.cursor];
  }
}

export function createField<T>(name: string, type?: FieldType, values?: T[]) {
  return {
    name,
    type,
    values: values ? values : [],
  };
}

/**
 * Wrapper to get an array from each field value
 */
export function getDataFrameRow(data: DataFrame, row: number): any[] {
  const values: any[] = [];
  for (const field of data.fields) {
    values.push(field.values[row]);
  }
  return values;
}

export function getDataFrameRowCount(data: DataFrame) {
  if (data && data.fields && data.fields.length) {
    // Assume the rest are the same size
    return data.fields[0].values.length;
  }
  return 0;
}

function asNumber(prop: any): number {
  if (isNumber(prop)) {
    return prop as number;
  }
  if (isString(prop)) {
    return parseInt(prop, 10);
  }
  return NaN;
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
