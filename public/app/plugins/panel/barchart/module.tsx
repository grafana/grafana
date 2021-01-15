import { FieldColorModeId, FieldConfigProperty, PanelPlugin, VizOrientation } from '@grafana/data';
import { BarChartPanel } from './BarChartPanel';
import { BarChartFieldConfig, BarChartOptions, BarStackingMode, BarValueVisibility } from '@grafana/ui';

export const plugin = new PanelPlugin<BarChartOptions, BarChartFieldConfig>(BarChartPanel)
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
    // TODO: import BarChartFieldConfig
  })
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
        defaultValue: VizOrientation.Auto,
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
        defaultValue: BarStackingMode.None,
      })
      .addRadio({
        path: 'showValue',
        name: 'Show value',
        settings: {
          options: [
            { value: BarValueVisibility.Auto, label: 'Auto' },
            { value: BarValueVisibility.Always, label: 'Always' },
            { value: BarValueVisibility.Never, label: 'Never' },
          ],
        },
        defaultValue: BarValueVisibility.Auto,
      });
  });
