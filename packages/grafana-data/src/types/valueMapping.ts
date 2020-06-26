export enum MappingType {
  ValueToText = 1,
  RangeToText = 2,
}

interface BaseMap {
  id: number; // Could/should be derived from the array index!!!
  // operator: string; // ???????????????
  text: string; // Result value
  type: MappingType;
}

export type ValueMapping = ValueMap | RangeMap;

export interface ValueMap extends BaseMap {
  value: string;
}

export interface RangeMap extends BaseMap {
  from: string;
  to: string;
}
