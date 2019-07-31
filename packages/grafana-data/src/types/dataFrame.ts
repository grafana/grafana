import { Threshold } from './threshold';
import { ValueMapping } from './valueMapping';
import { QueryResultBase, Labels } from './data';

export enum FieldType {
  time = 'time', // or date
  number = 'number',
  string = 'string',
  boolean = 'boolean',
  other = 'other', // Object, Array, etc
}

export interface Vector<T = any> {
  length: number;

  // Access the value by index (Like an array)
  get(index: number): T;

  // Iterator: for(const val of v)
  [Symbol.iterator](): IterableIterator<T>;
}

/**
 * Every property is optional
 */
export interface FieldSchema {
  title?: string; // The display value for this field.  This supports template variables blank is auto
  type?: FieldType;
  filterable?: boolean;

  // Date Options
  dateSourceFormat?: string;

  // Numeric Options
  unit?: string;
  decimals?: number | null; // Significant digits (for display)
  min?: number | null;
  max?: number | null;

  // Convert input values into a display string
  mappings?: ValueMapping[];

  // Must be sorted by 'value', first value is always -Infinity
  thresholds?: Threshold[];
}

export interface Field<T = any, V extends Vector<T> = Vector<T>> {
  name: string; // The column name

  schema: FieldSchema;
  values: V;
}

export interface DataFrame extends QueryResultBase {
  name?: string;
  fields: Field[];
  labels?: Labels;
}
