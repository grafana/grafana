export enum MappingType {
  ValueToText = 'value', // was 1
  RangeToText = 'range', // was 2
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

export type ValueMapping = ValueMap | RangeMap;
