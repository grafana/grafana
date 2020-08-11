export enum MappingType {
  ValueToText = 1,
  RangeToText = 2,
}

interface BaseMap {
  id: number; // this could/should just be the array index
  text: string; // the final display value
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
