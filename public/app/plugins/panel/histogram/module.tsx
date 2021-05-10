import { FieldColorModeId, FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { HistogramPanel } from './HistogramPanel';
import { graphFieldOptions } from '@grafana/ui';
import { PanelFieldConfig, PanelOptions, defaultPanelFieldConfig, defaultPanelOptions } from './models.gen';

export const plugin = new PanelPlugin<PanelOptions, PanelFieldConfig>(HistogramPanel)
  .setPanelOptions((builder) => {
    builder
      .addNumberInput({
        path: 'bucketSize',
        name: 'Bucket size',
        description: 'The bucket size',
        settings: {
          placeholder: 'Auto',
        },
        defaultValue: defaultPanelOptions.bucketSize,
      })
      .addNumberInput({
        path: 'bucketOffset',
        name: 'Bucket offset',
        description: 'where to start the bucket?',
        settings: {
          placeholder: '0',
        },
        defaultValue: defaultPanelOptions.bucketOffset,
      })
      .addBooleanSwitch({
        path: 'combine',
        name: 'Combine series',
        description: 'when multiple series exist, combine them into a single aggregate histogram',
        defaultValue: defaultPanelOptions.combine,
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
      const cfg = defaultPanelFieldConfig;

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
