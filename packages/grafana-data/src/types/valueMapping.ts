/**
 * @alpha
 */
export enum MappingType {
  ValueToText = 'value', // was 1
  RangeToText = 'range', // was 2
  RegexToText = 'regex',
  SpecialValue = 'special',
}

/**
 * @alpha
 */
export interface ValueMappingResult {
  text?: string;
  color?: string;
  icon?: string;
  index?: number;
}

/**
 * @alpha
 */
interface BaseValueMap<T> {
  type: MappingType;
  options: T;
}

/**
 * @alpha
 */
export interface ValueMap extends BaseValueMap<Record<string, ValueMappingResult>> {
  type: MappingType.ValueToText;
}

/**
 * @alpha
 */
export interface RangeMapOptions {
  from: number | null; // changed from string
  to: number | null;
  result: ValueMappingResult;
}

/**
 * @alpha
 */
export interface RangeMap extends BaseValueMap<RangeMapOptions> {
  type: MappingType.RangeToText;
}

/**
 * @alpha
 */
export interface RegexMapOptions {
  pattern: string;
  result: ValueMappingResult;
}

/**
 * @alpha
 */
export interface RegexMap extends BaseValueMap<RegexMapOptions> {
  type: MappingType.RegexToText;
}

/**
 * @alpha
 */
export interface SpecialValueOptions {
  match: SpecialValueMatch;
  result: ValueMappingResult;
}

/**
 * @alpha
 */
export enum SpecialValueMatch {
  True = 'true',
  False = 'false',
  Null = 'null',
  NaN = 'nan',
  NullAndNaN = 'null+nan',
  Empty = 'empty',
}

/**
 * @alpha
 */
export interface SpecialValueMap extends BaseValueMap<SpecialValueOptions> {
  type: MappingType.SpecialValue;
}

/**
 * @alpha
 */
export type ValueMapping = ValueMap | RangeMap | RegexMap | SpecialValueMap;
