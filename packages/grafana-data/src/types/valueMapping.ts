/**
 * @alpha
 */
export enum MappingType {
  ValueToText = 'value', // was 1
  RangeToText = 'range', // was 2
  RegexToText = 'regex',
  SpecialValue = 'special',
}

export interface ValueMappingResult {
  text?: string;
  color?: string;
  icon?: string;
  index?: number;
}

interface BaseValueMap<T> {
  type: MappingType;
  options: T;
}

export interface ValueMap extends BaseValueMap<Record<string, ValueMappingResult>> {
  type: MappingType.ValueToText;
}

export interface RangeMapOptions {
  from: number | null; // changed from string
  to: number | null;
  result: ValueMappingResult;
}

export interface RangeMap extends BaseValueMap<RangeMapOptions> {
  type: MappingType.RangeToText;
}

export interface RegexMapOptions {
  pattern: string;
  result: ValueMappingResult;
}

export interface RegexMap extends BaseValueMap<RegexMapOptions> {
  type: MappingType.RegexToText;
}

export interface SpecialValueOptions {
  match: SpecialValueMatch;
  result: ValueMappingResult;
}

export enum SpecialValueMatch {
  True = 'true',
  False = 'false',
  Null = 'null',
  NaN = 'nan',
  NullAndNaN = 'null+nan',
  Empty = 'empty',
}

export interface SpecialValueMap extends BaseValueMap<SpecialValueOptions> {
  type: MappingType.SpecialValue;
}

export type ValueMapping = ValueMap | RangeMap | RegexMap | SpecialValueMap;
