import { FieldColorModeId, FieldConfigProperty, PanelPlugin, VizOrientation } from '@grafana/data';
import { BarChartPanel } from './BarChartPanel';
import { BarChartOptions, BarStackingMode, defaults, ValueVisibility } from './types';

export const plugin = new PanelPlugin<BarChartOptions>(BarChartPanel)
  .useFieldConfig({
    standardOptions: {
      [FieldConfigProperty.Color]: {
        settings: {
          byValueSupport: false,
        },
        defaultValue: {
          mode: FieldColorModeId.PaletteClassic,
        },
      },
    },
  }) // ?? any custom properties?
  .setPanelOptions(builder => {
    builder
      .addRadio({
        path: 'orientation',
        name: 'Orientation',
        settings: {
          options: [
            { value: VizOrientation.Auto, label: 'Auto' },
            { value: VizOrientation.Horizontal, label: 'Horizontal' },
            { value: VizOrientation.Vertical, label: 'Vertical' },
          ],
        },
        defaultValue: defaults.orientation,
      })
      .addRadio({
        path: 'stacking',
        name: 'Stacking',
        settings: {
          options: [
            { value: BarStackingMode.None, label: 'None' },
            { value: BarStackingMode.Standard, label: 'Standard' },
            { value: BarStackingMode.Percent, label: '100%' },
          ],
        },
        defaultValue: defaults.stacking,
      })
      .addRadio({
        path: 'showValue',
        name: 'Show value',
        settings: {
          options: [
            { value: ValueVisibility.Auto, label: 'Auto' },
            { value: ValueVisibility.Always, label: 'Always' },
            { value: ValueVisibility.Never, label: 'Never' },
          ],
        },
        defaultValue: defaults.showValue,
      });
  });
