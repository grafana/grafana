/**
 * @internal
 */
export enum MappingType {
  ValueToText = 1,
  RangeToText = 2,
}

export interface ValueMappingResult {
  value?: number;
  state?: string;
  color?: string;
}

interface BaseMap {
  id: number; // this could/should just be the array index
  type: MappingType;
}

/**
 * @internal
 */
export type ValueMapping = ValueMap | RangeMap;

/**
 * @internal
 */
export interface ValueMap extends BaseMap {
  type: MappingType.ValueToText;
  map: Record<string, ValueMappingResult>;
}

/**
 * @internal
 */
export interface RangeMap extends BaseMap {
  type: MappingType.RangeToText;
  from: number;
  to: number;
  result: ValueMappingResult;
}
