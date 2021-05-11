export enum MappingType {
  ValueToText = 'value', // was 1
  RangeToText = 'range', // was 2
  SpecialValue = 'special',
}

export interface ValueMappingResult {
  text?: string;
  color?: string;
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

export type ValueMapping = ValueMap | RangeMap | SpecialValueMap;
