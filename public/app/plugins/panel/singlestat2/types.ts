import { VizOrientation, SingleStatBaseOptions, FieldDisplayOptions } from '@grafana/ui';
import { ReducerID } from '@grafana/data';

export interface SparklineOptions {
  show: boolean;
}

// Structure copied from angular
export interface SingleStatOptions extends SingleStatBaseOptions {
  sparkline: SparklineOptions;
}

export const standardFieldDisplayOptions: FieldDisplayOptions = {
  values: false,
  calcs: [ReducerID.mean],
  defaults: {
    min: 0,
    max: 100,
    thresholds: [
      { value: -Infinity, color: 'green' },
      { value: 80, color: 'red' }, // 80%
    ],
    mappings: [],
  },
  override: {},
};

export const defaults: SingleStatOptions = {
  sparkline: {
    show: true,
  },
  fieldOptions: standardFieldDisplayOptions,
  orientation: VizOrientation.Auto,
};
