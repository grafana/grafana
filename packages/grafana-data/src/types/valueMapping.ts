export enum MappingType {
  ValueToText = 1,
  RangeToText = 2,
}

interface BaseMap {
  id: number;
  operator: string;
  text: string;
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
