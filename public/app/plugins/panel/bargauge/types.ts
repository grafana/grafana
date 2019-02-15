import { Threshold, ValueMapping } from '@grafana/ui';

export interface BarGaugeOptions {
  minValue: number;
  maxValue: number;
  prefix: string;
  stat: string;
  suffix: string;
  unit: string;
  valueMappings: ValueMapping[];
  thresholds: Threshold[];
}

export const PanelDefaults: BarGaugeOptions = {
  minValue: 0,
  maxValue: 100,
  prefix: '',
  suffix: '',
  stat: 'avg',
  unit: 'none',
  thresholds: [],
  valueMappings: [],
};
