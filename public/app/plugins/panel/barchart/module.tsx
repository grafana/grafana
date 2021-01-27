import { FieldColorModeId, FieldConfigProperty, PanelPlugin, VizOrientation } from '@grafana/data';
import { BarChartPanel } from './BarChartPanel';
import { BarChartFieldConfig, BarChartOptions, BarStackingMode, BarValueVisibility } from '@grafana/ui';
import { addLegendOptions } from '../timeseries/config';

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
  .setPanelOptions((builder) => {
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
            { value: BarStackingMode.Percent, label: 'Percent' },
          ],
        },
        defaultValue: BarStackingMode.None,
      })
      .addRadio({
        path: 'showValue',
        name: 'Show values',
        settings: {
          options: [
            { value: BarValueVisibility.Auto, label: 'Auto' },
            { value: BarValueVisibility.Always, label: 'Always' },
            { value: BarValueVisibility.Never, label: 'Never' },
          ],
        },
        defaultValue: BarValueVisibility.Auto,
      })
      .addSliderInput({
        path: 'groupWidth',
        name: 'Group width',
        defaultValue: 0.7,
        settings: {
          min: 0,
          max: 1,
          step: 0.01,
        },
        showIf: (c) => c.stacking === BarStackingMode.None,
      })
      .addSliderInput({
        path: 'barWidth',
        name: 'Bar width',
        defaultValue: 0.97,
        settings: {
          min: 0,
          max: 1,
          step: 0.01,
        },
      });

    addLegendOptions(builder, true);
  });
