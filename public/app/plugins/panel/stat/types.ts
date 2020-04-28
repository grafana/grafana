import { SingleStatBaseOptions, BigValueColorMode, BigValueGraphMode, BigValueJustifyMode } from '@grafana/ui';
import { ReducerID, SelectableValue, standardEditorsRegistry } from '@grafana/data';
import { PanelOptionsEditorBuilder } from '@grafana/data';

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

export function addStandardDataReduceOptions(
  builder: PanelOptionsEditorBuilder<SingleStatBaseOptions>,
  includeOrientation = true
) {
  builder.addRadio({
    path: 'reduceOptions.values',
    name: 'Show',
    description: 'Calculate a single value per colum or series or show each row',
    settings: {
      options: [
        { value: false, label: 'Calculate' },
        { value: true, label: 'All values' },
      ],
    },
    defaultValue: false,
  });

  builder.addNumberInput({
    path: 'reduceOptions.limit',
    name: 'Limit',
    description: 'Max number of rows to display',
    settings: {
      placeholder: '5000',
      integer: true,
      min: 1,
      max: 5000,
    },
    showIf: options => options.reduceOptions.values === true,
  });

  builder.addCustomEditor({
    id: 'reduceOptions.calcs',
    path: 'reduceOptions.calcs',
    name: 'Value',
    description: 'Choose a reducer function / calculation',
    editor: standardEditorsRegistry.get('stats-picker').editor as any,
    defaultValue: [ReducerID.mean],
  });

  if (includeOrientation) {
    builder.addRadio({
      path: 'orientation',
      name: 'Orientation',
      description: 'Stacking direction in case of multiple series or fields',
      settings: {
        options: [
          { value: 'auto', label: 'Auto' },
          { value: 'horizontal', label: 'Horizontal' },
          { value: 'vertical', label: 'Vertical' },
        ],
      },
      defaultValue: 'auto',
    });
  }
}
