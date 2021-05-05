import { FieldColorModeId, FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { HistogramPanel } from './HistogramPanel';
import { HistogramOptions, HistogramFieldConfig, graphFieldOptions } from '@grafana/ui';
import { defaultHistogramFieldConfig } from '@grafana/ui/src/components/Histogram/types';

export const plugin = new PanelPlugin<HistogramOptions, HistogramFieldConfig>(HistogramPanel)
  .setPanelOptions((builder) => {
    builder.addNumberInput({
      path: 'bucketSize',
      name: 'Bucket size',
      //category: ['Axis'],
      settings: {
        placeholder: 'Auto',
      },
    });
  })
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
    useCustomConfig: (builder) => {
      const cfg = defaultHistogramFieldConfig;

      builder
        .addSliderInput({
          path: 'lineWidth',
          name: 'Line width',
          defaultValue: cfg.lineWidth,
          settings: {
            min: 0,
            max: 10,
            step: 1,
          },
        })
        .addSliderInput({
          path: 'fillOpacity',
          name: 'Fill opacity',
          defaultValue: cfg.fillOpacity,
          settings: {
            min: 0,
            max: 100,
            step: 1,
          },
        })
        .addRadio({
          path: 'gradientMode',
          name: 'Gradient mode',
          defaultValue: graphFieldOptions.fillGradient[0].value,
          settings: {
            options: graphFieldOptions.fillGradient,
          },
        });
    },
  });
