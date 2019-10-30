import { SingleStatBaseOptions, SingleStatDisplayMode } from '@grafana/ui';
import { VizOrientation, ReducerID, FieldDisplayOptions, SelectableValue } from '@grafana/data';

export interface SparklineOptions {
  show: boolean;
}

// Structure copied from angular
export interface SingleStatOptions extends SingleStatBaseOptions {
  sparkline: SparklineOptions;
  colorMode: ColorMode;
  displayMode: SingleStatDisplayMode;
}

export const displayModes: Array<SelectableValue<SingleStatDisplayMode>> = [
  { value: SingleStatDisplayMode.Classic, label: 'Classic' },
  { value: SingleStatDisplayMode.Classic2, label: 'Classic 2' },
  { value: SingleStatDisplayMode.Vibrant, label: 'Vibrant' },
  { value: SingleStatDisplayMode.Vibrant2, label: 'Vibrant 2' },
];

export enum ColorMode {
  Thresholds,
  Series,
}

export const colorModes: Array<SelectableValue<ColorMode>> = [
  { value: ColorMode.Thresholds, label: 'Thresholds' },
  { value: ColorMode.Series, label: 'Series' },
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
  colorMode: ColorMode.Thresholds,
  displayMode: SingleStatDisplayMode.Vibrant,
  fieldOptions: standardFieldDisplayOptions,
  orientation: VizOrientation.Auto,
};
