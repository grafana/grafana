import { SingleStatBaseOptions, BigValueDisplayMode } from '@grafana/ui';
import { VizOrientation, ReducerID, FieldDisplayOptions, SelectableValue } from '@grafana/data';

export interface SparklineOptions {
  show: boolean;
}

// Structure copied from angular
export interface StatPanelOptions extends SingleStatBaseOptions {
  sparkline: SparklineOptions;
  displayMode: BigValueDisplayMode;
}

export const displayModes: Array<SelectableValue<BigValueDisplayMode>> = [
  { value: BigValueDisplayMode.Classic, label: 'Classic' },
  { value: BigValueDisplayMode.Vibrant, label: 'Vibrant' },
  { value: BigValueDisplayMode.Vibrant2, label: 'Vibrant 2' },
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

export const defaults: StatPanelOptions = {
  sparkline: {
    show: true,
  },
  displayMode: BigValueDisplayMode.Vibrant,
  fieldOptions: standardFieldDisplayOptions,
  orientation: VizOrientation.Auto,
};
