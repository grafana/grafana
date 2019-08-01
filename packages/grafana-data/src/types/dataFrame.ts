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
  // get(index: number): T;
  [index: number]: T;

  /**
   * Appends new elements to the vector, and returns the new length of the vector.
   * @param items New elements of the Vector.
   *
   * Some implementations may ignore the input or throw an error
   */
  push(...items: T[]): number;
}

/**
 * Every property is optional
 *
 * Plugins may extend this with additional properties
 */
export interface FieldDisplayConfig {
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
}

export interface Field<T = any> {
  name: string; // The column name
  type?: FieldType;
  display?: FieldDisplayConfig;
  values: Vector<T>;
}

export interface DataFrame extends QueryResultBase {
  name?: string;
  fields: Field[];
  labels?: Labels;
}

// export interface Field<T = any> extends FieldBase<T>, Vector<T> {
//   // TODO -- cache here so all components can use it
//   stats?: {[key:string]:any};
//   processor?: (value:any) => {};
// }

// export interface DataFrame extends DataFrameBase<Field> {
//   toJavascript: () => DataFrameBase;
//   getField: (name:string) => Field;
//   getView: <T>() => Vector<T>;
// }
