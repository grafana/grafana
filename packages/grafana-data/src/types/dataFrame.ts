import { ScopedVars } from './ScopedVars';
import { QueryResultBase, Labels, NullValueMode } from './data';
import { DataLink, LinkModel } from './dataLink';
import { DecimalCount, DisplayProcessor, DisplayValue, DisplayValueAlignmentFactors } from './displayValue';
import { FieldColor } from './fieldColor';
import { ThresholdsConfig } from './thresholds';
import { ValueMapping } from './valueMapping';
import { Vector } from './vector';

/** @public */
export enum FieldType {
  time = 'time', // or date
  number = 'number',
  string = 'string',
  boolean = 'boolean',
  // Used to detect that the value is some kind of trace data to help with the visualisation and processing.
  trace = 'trace',
  geo = 'geo',
  enum = 'enum',
  other = 'other', // Object, Array, etc
  frame = 'frame', // DataFrame
}

/**
 * @public
 * Every property is optional
 *
 * Plugins may extend this with additional properties. Something like series overrides
 */
export interface FieldConfig<TOptions = any> {
  /**
   * The display value for this field.  This supports template variables blank is auto.
   * If you are a datasource plugin, do not set this. Use `field.value` and if that
   * is not enough, use `field.config.displayNameFromDS`.
   */
  displayName?: string;

  /**
   * This can be used by data sources that need to customize how values are named.
   * When this property is configured, this value is used rather than the default naming strategy.
   */
  displayNameFromDS?: string;

  /**
   * Human readable field metadata
   */
  description?: string;

  /**
   * An explict path to the field in the datasource.  When the frame meta includes a path,
   * This will default to `${frame.meta.path}/${field.name}
   *
   * When defined, this value can be used as an identifier within the datasource scope, and
   * may be used to update the results
   */
  path?: string;

  /**
   * True if data source can write a value to the path.  Auth/authz are supported separately
   */
  writeable?: boolean;

  /**
   * True if data source field supports ad-hoc filters
   */
  filterable?: boolean;

  // Numeric Options
  unit?: string;
  decimals?: DecimalCount; // Significant digits (for display)
  min?: number | null;
  max?: number | null;

  // Interval indicates the expected regular step between values in the series.
  // When an interval exists, consumers can identify "missing" values when the expected value is not present.
  // The grafana timeseries visualization will render disconnected values when missing values are found it the time field.
  // The interval uses the same units as the values.  For time.Time, this is defined in milliseconds.
  interval?: number | null;

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

  // The field type may map to specific config
  type?: FieldTypeConfig;

  // Panel Specific Values
  custom?: TOptions;
}

export interface FieldTypeConfig {
  enum?: EnumFieldConfig;
}

export interface EnumFieldConfig {
  text?: string[];
  color?: string[];
  icon?: string[];
  description?: string[];
}

/** @public */
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

  /**
   * The raw field values
   * In Grafana 10, this accepts both simple arrays and the Vector interface
   * In Grafana 11, the Vector interface will be removed
   */
  values: V | T[];

  /**
   * When type === FieldType.Time, this can optionally store
   * the nanosecond-precison fractions as integers between
   * 0 and 999999.
   */
  nanos?: number[];

  labels?: Labels;

  /**
   * Cached values with appropriate display and id values
   */
  state?: FieldState | null;

  /**
   * Convert a value for display
   */
  display?: DisplayProcessor;

  /**
   * Get value data links with variables interpolated
   */
  getLinks?: (config: ValueLinkConfig) => Array<LinkModel<Field>>;
}

/** @alpha */
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
   * The numeric range for values in this field.  This value will respect the min/max
   * set in field config, or when set to `auto` this will have the min/max for all data
   * in the response
   */
  range?: NumericRange;

  /**
   * Appropriate values for templating
   */
  scopedVars?: ScopedVars;

  /**
   * Series index is index for this field in a larger data set that can span multiple DataFrames
   * Useful for assigning color to series by looking up a color in a palette using this index
   */
  seriesIndex?: number;

  /**
   * Location of this field within the context frames results
   *
   * @internal -- we will try to make this unnecessary
   */
  origin?: DataFrameFieldIndex;

  /**
   * Boolean value is true if field is in a larger data set with multiple frames.
   * This is only related to the cached displayName property above.
   */
  multipleFrames?: boolean;

  /**
   * Boolean value is true if a null filling threshold has been applied
   * against the frame of the field. This is used to avoid cases in which
   * this would applied more than one time.
   */
  nullThresholdApplied?: boolean;

  /**
   * Can be used by visualizations to cache max display value lengths to aid alignment.
   * It's up to each visualization to calculate and set this.
   */
  alignmentFactors?: DisplayValueAlignmentFactors;
}

/** @public */
export interface NumericRange {
  min?: number | null;
  max?: number | null;
  delta: number;
}

export interface DataFrame extends QueryResultBase {
  name?: string;
  fields: Field[]; // All fields of equal length

  // The number of rows
  length: number;
}

/**
 * @public
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
 * @public
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

/**
 * Describes where a specific data frame field is located within a
 * dataset of type DataFrame[]
 *
 * @internal -- we will try to make this unnecessary
 */
export interface DataFrameFieldIndex {
  frameIndex: number;
  fieldIndex: number;
}
