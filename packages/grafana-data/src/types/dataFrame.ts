import { Threshold } from './threshold';
import { ValueMapping } from './valueMapping';
import { QueryResultBase, Labels, NullValueMode } from './data';
import { FieldCalcs } from '../utils/index';

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

  // Date Options
  dateFormat?: string;

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

  // Alternative to empty string
  noValue?: string;
}

export interface FieldJSON<T = any> {
  name: string; // The column name
  type?: FieldType;
  config?: FieldConfig;
  buffer?: T[];
}

export interface DataFrameJSON extends QueryResultBase {
  name?: string;
  labels?: Labels;
  fields: FieldJSON[];
}

export interface Vector<T = any> {
  getLength(): number;

  /**
   * Access the value by index (Like an array)
   */
  get(index: number): T;
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
   * TODO: attach the display processor to each field
   */
  display?: (value: T) => any; // DisplayValue
}

export interface DataFrame extends QueryResultBase {
  name?: string;
  fields: Field[]; // All fields of equal length
  labels?: Labels;

  // The number of rows
  getLength(): number;
}
