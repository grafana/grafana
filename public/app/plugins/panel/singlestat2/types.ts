import { VizOrientation, SingleStatBaseOptions, FieldDisplayOptions } from '@grafana/ui';
import { ReducerID } from '@grafana/data';
import { SelectableValue } from '@grafana/data';

export interface SparklineOptions {
  show: boolean;
}

// Structure copied from angular
export interface SingleStatOptions extends SingleStatBaseOptions {
  sparkline: SparklineOptions;
  colorMode: ColorMode;
  displayMode: DisplayMode;
}

export enum DisplayMode {
  Classic,
  ColoredTiles,
  ColoredAreaGraph,
}

export const displayModes: Array<SelectableValue<DisplayMode>> = [
  { value: DisplayMode.Classic, label: 'Classic' },
  { value: DisplayMode.ColoredTiles, label: 'Colored Tiles' },
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
  displayMode: DisplayMode.ColoredTiles,
  fieldOptions: standardFieldDisplayOptions,
  orientation: VizOrientation.Auto,
};
