export interface Threshold {
  index: number;
  value: number;
  color?: string;
}

export enum MappingType {
  ValueToText = 1,
  RangeToText = 2,
}

export enum BasicGaugeColor {
  Green = '#299c46',
  Red = '#d44a3a',
}

interface BaseMap {
  id: number;
  operator: string;
  text: string;
  type: MappingType;
}

export interface ValueMap extends BaseMap {
  value: string;
}

export interface RangeMap extends BaseMap {
  from: string;
  to: string;
}
