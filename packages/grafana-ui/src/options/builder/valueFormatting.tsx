import { OptionsWithValueFormatting } from '../models.gen';
import { PanelOptionsEditorBuilder } from '@grafana/data';

export enum VizValueFormattingMode {
  Auto = 'auto',
  Fixed = 'fixed',
}
export type VizValueFormattingOptions = {
  size?: number;
  mode: VizValueFormattingMode;
};

export function addValueFormattingOptions<T extends OptionsWithValueFormatting>(builder: PanelOptionsEditorBuilder<T>) {
  builder
    .addRadio({
      path: 'valueFormatting.mode',
      name: 'Value label size mode',
      category: ['Value formatting'],
      description: '',
      defaultValue: VizValueFormattingMode.Auto,
      settings: {
        options: [
          {
            value: VizValueFormattingMode.Auto,
            label: 'Auto',
          },
          {
            value: VizValueFormattingMode.Fixed,
            label: 'Fixed',
          },
        ],
      },
    })
    .addSliderInput({
      path: 'valueFormatting.size',
      name: 'Size',
      category: ['Value formatting'],
      description: '',
      settings: {
        min: 10,
        max: 48,
        step: 1,
      },
      showIf: (c) => c.valueFormatting.mode === VizValueFormattingMode.Fixed,
    });
}
