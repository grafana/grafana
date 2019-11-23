import { SingleStatBaseOptions, SingleStatDisplayMode } from '@grafana/ui';
import { VizOrientation, ReducerID, FieldDisplayOptions, SelectableValue } from '@grafana/data';

export interface SparklineOptions {
  show: boolean;
}

// Structure copied from angular
export interface SingleStatOptions extends SingleStatBaseOptions {
  sparkline: SparklineOptions;
  displayMode: SingleStatDisplayMode;
}

export const displayModes: Array<SelectableValue<SingleStatDisplayMode>> = [
  { value: SingleStatDisplayMode.Classic, label: 'Classic' },
  { value: SingleStatDisplayMode.Vibrant, label: 'Vibrant' },
  { value: SingleStatDisplayMode.Vibrant2, label: 'Vibrant 2' },
];

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
  displayMode: SingleStatDisplayMode.Vibrant,
  fieldOptions: standardFieldDisplayOptions,
  orientation: VizOrientation.Auto,
};
