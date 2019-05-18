import { VizOrientation, ReducerID, SingleStatBaseOptions, FieldDisplayOptions } from '@grafana/ui';

export interface SparklineOptions {
  show: boolean;
  full: boolean; // full height
  fillColor: string;
  lineColor: string;
}

// Structure copied from angular
export interface SingleStatOptions extends SingleStatBaseOptions {
  prefixFontSize?: string;
  valueFontSize?: string;
  postfixFontSize?: string;

  colorBackground?: boolean;
  colorValue?: boolean;
  colorPrefix?: boolean;
  colorPostfix?: boolean;

  sparkline: SparklineOptions;
}

export const standardFieldDisplayOptions: FieldDisplayOptions = {
  values: false,
  calcs: [ReducerID.mean],
  defaults: {},
  override: {},
  mappings: [],
  thresholds: [{ index: 0, value: -Infinity, color: 'green' }, { index: 1, value: 80, color: 'red' }],
};

export const defaults: SingleStatOptions = {
  sparkline: {
    show: true,
    full: false,
    lineColor: 'rgb(31, 120, 193)',
    fillColor: 'rgba(31, 118, 189, 0.18)',
  },
  fieldOptions: standardFieldDisplayOptions,
  orientation: VizOrientation.Auto,
};
