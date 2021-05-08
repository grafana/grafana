export enum MappingType {
  ValueToText = 'value', // was 1
  RangeToText = 'range', // was 2
}

export interface ValueMappingResult {
  value?: number; // use isNaN(value)
  state?: string; // not yet used -- or text
  color?: string;
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

export type ValueMapping = ValueMap | RangeMap;
