import { SingleStatBaseOptions, BigValueColorMode, BigValueGraphMode, BigValueJustifyMode } from '@grafana/ui';
import { VizOrientation, ReducerID, ReduceDataOptions, SelectableValue, standardEditorsRegistry } from '@grafana/data';
import { PanelOptionsEditorBuilder } from '@grafana/data/src/utils/OptionsUIBuilders';

// Structure copied from angular
export interface StatPanelOptions extends SingleStatBaseOptions {
  graphMode: BigValueGraphMode;
  colorMode: BigValueColorMode;
  justifyMode: BigValueJustifyMode;
}

export const colorModes: Array<SelectableValue<BigValueColorMode>> = [
  { value: BigValueColorMode.Value, label: 'Value' },
  { value: BigValueColorMode.Background, label: 'Background' },
];

export const graphModes: Array<SelectableValue<BigValueGraphMode>> = [
  { value: BigValueGraphMode.None, label: 'None' },
  { value: BigValueGraphMode.Area, label: 'Area graph' },
];

export const justifyModes: Array<SelectableValue<BigValueJustifyMode>> = [
  { value: BigValueJustifyMode.Auto, label: 'Auto' },
  { value: BigValueJustifyMode.Center, label: 'Center' },
];

export const commonValueOptionDefaults: ReduceDataOptions = {
  values: false,
  calcs: [ReducerID.mean],
};

export function addStandardDataReduceOptions(builder: PanelOptionsEditorBuilder<StatPanelOptions>) {
  builder.addRadio({
    id: 'reduceOptions.values',
    name: 'Show',
    description: 'Calculate a single value per colum or series or show each row',
    settings: {
      options: [
        { value: false, label: 'Calculate' },
        { value: true, label: 'All values' },
      ],
    },
  });

  builder.addNumberInput({
    id: 'reduceOptions.limit',
    name: 'Limit',
    description: 'Max number of rows to display',
    settings: {
      placeholder: '5000',
      integer: true,
      min: 1,
      max: 5000,
    },
  });

  builder.addCustomEditor({
    id: 'reduceOptions.calcs',
    name: 'Value',
    description: 'Choose a reducer function / calculation',
    editor: standardEditorsRegistry.get('stats-picker').editor as any,
  });

  builder.addRadio({
    id: 'orientation',
    name: 'Orientation',
    description: 'Stacking direction in case of multiple series or fields',
    settings: {
      options: [
        { value: 'auto', label: 'Auto' },
        { value: 'horizontal', label: 'Horizontal' },
        { value: 'vertical', label: 'Vertical' },
      ],
    },
  });
}

export const defaults: StatPanelOptions = {
  graphMode: BigValueGraphMode.Area,
  colorMode: BigValueColorMode.Value,
  justifyMode: BigValueJustifyMode.Auto,
  reduceOptions: commonValueOptionDefaults,
  orientation: VizOrientation.Auto,
};
