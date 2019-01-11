import { BasicGaugeColor, RangeMap, Threshold, ValueMap } from './panel';

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

export const GaugePanelOptionsDefaultProps = {
  options: {
    baseColor: BasicGaugeColor.Green,
    minValue: 0,
    maxValue: 100,
    prefix: '',
    showThresholdMarkers: true,
    showThresholdLabels: false,
    suffix: '',
    decimals: 0,
    stat: 'avg',
    unit: 'none',
    mappings: [],
    thresholds: [],
  },
};
