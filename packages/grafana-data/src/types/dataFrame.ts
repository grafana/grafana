import { ThresholdsConfig } from './thresholds';
import { ValueMapping } from './valueMapping';
import { QueryResultBase, Labels, NullValueMode } from './data';
import { DisplayProcessor } from './displayValue';
import { DataLink } from './dataLink';
import { Vector } from './vector';
import { FieldCalcs } from '../transformations/fieldReducer';
import { FieldColor } from './fieldColor';
import { ScopedVars } from './ScopedVars';

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
 * Plugins may extend this with additional properties. Something like series overrides
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

  // Map numeric values to states
  thresholds?: ThresholdsConfig;

  // Map values to a display color
  color?: FieldColor;

  // Used when reducing field values
  nullValueMode?: NullValueMode;

  // The behavior when clicking on a result
  links?: DataLink[];

  // Alternative to empty string
  noValue?: string;

  // Panel Specific Values
  custom?: Record<string, any>;

  scopedVars?: ScopedVars;
}

export interface Field<T = any, V = Vector<T>> {
  /**
   * Name of the field (column)
   */
  name: string;
  /**
   *  Field value type (string, number, etc)
   */
  type: FieldType;
  /**
   *  Meta info about how field and how to display it
   */
  config: FieldConfig;
  values: V; // The raw field values
  labels?: Labels;

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
  labels?: Labels;
}

/**
 * Like a DataFrame, but fields may be a FieldDTO
 */
export interface DataFrameDTO extends QueryResultBase {
  name?: string;
  fields: Array<FieldDTO | Field>;
}
