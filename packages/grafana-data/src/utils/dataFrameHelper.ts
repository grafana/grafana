import { Field, FieldType, DataFrame, Vector } from '../types/dataFrame';
import { Labels, QueryResultMeta, NullValueMode } from '../types/data';
import { guessFieldTypeForField, guessFieldTypeFromValue } from './processDataFrame';
import isNumber from 'lodash/isNumber';
import isString from 'lodash/isString';
import { FieldCalcs, reduceField } from './fieldReducer';

interface FieldWithCache extends Field {
  /**
   * The field index within the frame
   */
  index: number;

  /**
   * Cache of reduced fields
   */
  stats?: FieldCalcs;

  /**
   * TODO: based on config, save the display processor
   */
  processor?: (value: any) => {}; // DisplayValue

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

  private addFieldFor(value: any, name?: string): FieldWithCache {
    if (!name) {
      name = `Column ${this.fields.length + 1}`;
    }
    return this.addField({
      name,
      type: guessFieldTypeFromValue(value),
      values: [],
    });
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

  addField(f: Field): FieldWithCache {
    const field = {
      index: this.fields.length,
      ...f,
      reduce: (
        reducers: string[], // The stats to calculate
        nullValueMode?: NullValueMode
      ): FieldCalcs => {
        return this.reduce(field, reducers, nullValueMode);
      },
    };
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

    // And a name
    if (!field.name) {
      field.name = `Column ${field.index + 1}`;
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
    for (let i = this.fields.length; i < row.length; i++) {}
    for (let i = 0; i < this.fields.length; i++) {
      this.fields[i].values.push(row[i]); // may be undefined
    }
    this.longestFieldLength++;
  }

  /**
   * This will add the row
   */
  appendObject(row: { [key: string]: any }) {
    for (const key of Object.keys(row)) {
      const v = row[key];
      let f = this.fieldByName[key];
      if (!f) {
        f = this.addFieldFor(v, key);
      }
      f.values.push(v);
    }
    this.longestFieldLength++;

    // Make sure everything has the same length
    for (let i = 0; i < this.fields.length; i++) {
      if (this.fields[i].values.length !== this.longestFieldLength) {
        this.fields[i].values.push(undefined);
      } // may be undefined
    }
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
