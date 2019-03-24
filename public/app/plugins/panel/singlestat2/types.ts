import { VizOrientation, ValueMapping, Threshold, StatID } from '@grafana/ui';

export interface SingleStatBaseOptions {
  valueMappings: ValueMapping[];
  thresholds: Threshold[];
  valueOptions: SingleStatValueOptions;
  orientation: VizOrientation;
}

export interface SingleStatValueOptions {
  unit: string;
  suffix: string;
  stat: string;
  prefix: string;
  decimals?: number | null;
}

export interface SingleStatOptions extends SingleStatBaseOptions {
  // TODO, fill in with options from angular
}

export const defaults: SingleStatOptions = {
  valueOptions: {
    prefix: '',
    suffix: '',
    decimals: null,
    stat: StatID.mean,
    unit: 'none',
  },
  valueMappings: [],
  thresholds: [{ index: 0, value: -Infinity, color: 'green' }, { index: 1, value: 80, color: 'red' }],
  orientation: VizOrientation.Auto,
};
