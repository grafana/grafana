import { RangeMap, Threshold, ValueMap } from './panel';

export interface GaugeOptions {
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
