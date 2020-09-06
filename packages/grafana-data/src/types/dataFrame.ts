import { ThresholdsConfig } from './thresholds';
import { ValueMapping } from './valueMapping';
import { QueryResultBase, Labels, NullValueMode } from './data';
import { DisplayProcessor, DisplayValue } from './displayValue';
import { DataLink, LinkModel } from './dataLink';
import { Vector } from './vector';
import { FieldColor } from './fieldColor';
import { ScopedVars } from './ScopedVars';

export enum FieldType {
  time = 'time', // or date
  number = 'number',
  string = 'string',
  boolean = 'boolean',
  // Used to detect that the value is some kind of trace data to help with the visualisation and processing.
  trace = 'trace',
  other = 'other', // Object, Array, etc
}

/**
 * Every property is optional
 *
 * Plugins may extend this with additional properties. Something like series overrides
 */
export interface FieldConfig<TOptions extends object = any> {
  /**
   * The display value for this field.  This supports template variables blank is auto
   */
  displayName?: string;

  /**
   * This can be used by data sources that return and explicit naming structure for values and labels
   * When this property is configured, this value is used rather than the default naming strategy.
   */
  displayNameFromDS?: string;

  /**
   * True if data source field supports ad-hoc filters
   */
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
  custom?: TOptions;
}

export interface ValueLinkConfig {
  /**
   * Result of field reduction
   */
  calculatedValue?: DisplayValue;
  /**
   * Index of the value row within Field. Should be provided only when value is not a result of a reduction
   */
  valueRowIndex?: number;
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
   * Cached values with appropriate display and id values
   */
  state?: FieldState | null;

  /**
   * Convert text to the field value
   */
  parse?: (value: any) => T;

  /**
   * Convert a value for display
   */
  display?: DisplayProcessor;

  /**
   * Get value data links with variables interpolated
   */
  getLinks?: (config: ValueLinkConfig) => Array<LinkModel<Field>>;
}

export interface FieldState {
  /**
   * An appropriate name for the field (does not include frame info)
   */
  displayName?: string | null;

  /**
   * Cache of reduced values
   */
  calcs?: FieldCalcs;

  /**
   * Appropriate values for templating
   */
  scopedVars?: ScopedVars;
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

export interface FieldCalcs extends Record<string, any> {}

export const TIME_SERIES_VALUE_FIELD_NAME = 'Value';
export const TIME_SERIES_TIME_FIELD_NAME = 'Time';
export const TIME_SERIES_METRIC_FIELD_NAME = 'Metric';
