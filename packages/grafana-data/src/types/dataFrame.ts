import { Threshold } from './threshold';
import { ValueMapping } from './valueMapping';
import { QueryResultBase, Labels, NullValueMode } from './data';
import { FieldCalcs } from '../utils/index';
import { DisplayProcessor } from './displayValue';
import { DataLink } from './dataLink';

export enum FieldType {
  time = 'time', // or date
  number = 'number',
  string = 'string',
  boolean = 'boolean',
  other = 'other', // Object, Array, etc
}

/**
 * Every property is optional
 *
 * Plugins may extend this with additional properties.  Somethign like series overrides
 */
export interface FieldConfig {
  title?: string; // The display value for this field.  This supports template variables blank is auto
  filterable?: boolean;

  // Numeric Options
  unit?: string;
  decimals?: number | null; // Significant digits (for display)
  min?: number | null;
  max?: number | null;

  // Convert input values into a display string
  mappings?: ValueMapping[];

  // Must be sorted by 'value', first value is always -Infinity
  thresholds?: Threshold[];

  // Used when reducing field values
  nullValueMode?: NullValueMode;

  // The behavior when clicking on a result
  links?: DataLink[];

  // Alternative to empty string
  noValue?: string;
}

export interface Vector<T = any> {
  length: number;

  /**
   * Access the value by index (Like an array)
   */
  get(index: number): T;

  /**
   * Get the resutls as an array.
   */
  toArray(): T[];

  /**
   * Return the values as a simple array for json serialization
   */
  toJSON(): any; // same results as toArray()
}

export interface Field<T = any> {
  name: string; // The column name
  type: FieldType;
  config: FieldConfig;
  values: Vector<T>; // `buffer` when JSON

  /**
   * Cache of reduced values
   */
  calcs?: FieldCalcs;

  /**
   * Convert text to the field value
   */
  parse?: (value: any) => T;

  /**
   * Convert a value for display
   */
  display?: DisplayProcessor;
}

export interface DataFrame extends QueryResultBase {
  name?: string;
  fields: Field[]; // All fields of equal length
  labels?: Labels;

  // The number of rows
  length: number;
}

/**
 * Like a field, but properties are optional and values may be a simple array
 */
export interface FieldDTO<T = any> {
  name: string; // The column name
  type?: FieldType;
  config?: FieldConfig;
  values?: Vector<T> | T[]; // toJSON will always be T[], input could be either
}

/**
 * Like a DataFrame, but fields may be a FieldDTO
 */
export interface DataFrameDTO extends QueryResultBase {
  name?: string;
  labels?: Labels;
  fields: Array<FieldDTO | Field>;
}
