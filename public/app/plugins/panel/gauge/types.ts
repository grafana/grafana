import { RangeMap, ValueMap, Threshold } from 'app/types';

export interface Options {
  baseColor: string;
  decimals: number;
  mappings: Array<RangeMap | ValueMap>;
  maxValue: number;
  minValue: number;
  prefix: string;
  showThresholdLabels: boolean;
  showThresholdMarkers: boolean;
  stat: string;
  suffix: string;
  thresholds: Threshold[];
  unit: string;
}
