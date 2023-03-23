import { FieldColorModeId, FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { histogramFieldInfo } from '@grafana/data/src/transformations/transformers/histogram';
import { commonOptionsBuilder, graphFieldOptions } from '@grafana/ui';

import { HistogramPanel } from './HistogramPanel';
import { FieldConfig, Options, defaultFieldConfig, defaultOptions } from './panelcfg.gen';
import { originalDataHasHistogram } from './utils';

export const plugin = new PanelPlugin<Options, FieldConfig>(HistogramPanel)
  .setPanelOptions((builder) => {
    builder
      .addCustomEditor({
        id: '__calc__',
        path: '__calc__',
        name: 'Values',
        description: 'Showing frequencies that are calculated in the query',
        editor: () => null, // empty editor
        showIf: (opts, data) => originalDataHasHistogram(data),
      })
      .addNumberInput({
        path: 'bucketSize',
        name: histogramFieldInfo.bucketSize.name,
        description: histogramFieldInfo.bucketSize.description,
        settings: {
          placeholder: 'Auto',
          min: 0,
        },
        defaultValue: defaultOptions.bucketSize,
        showIf: (opts, data) => !originalDataHasHistogram(data),
      })
      .addNumberInput({
        path: 'bucketOffset',
        name: histogramFieldInfo.bucketOffset.name,
        description: histogramFieldInfo.bucketOffset.description,
        settings: {
          placeholder: '0',
          min: 0,
        },
        defaultValue: defaultOptions.bucketOffset,
        showIf: (opts, data) => !originalDataHasHistogram(data),
      })
      .addBooleanSwitch({
        path: 'combine',
        name: histogramFieldInfo.combine.name,
        description: histogramFieldInfo.combine.description,
        defaultValue: defaultOptions.combine,
        showIf: (opts, data) => !originalDataHasHistogram(data),
      });

    // commonOptionsBuilder.addTooltipOptions(builder);
    commonOptionsBuilder.addLegendOptions(builder);
  })
  .useFieldConfig({
    standardOptions: {
      [FieldConfigProperty.Color]: {
        settings: {
          byValueSupport: true,
        },
        defaultValue: {
          mode: FieldColorModeId.PaletteClassic,
        },
      },
    },
    useCustomConfig: (builder) => {
      const cfg = defaultFieldConfig;

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

      commonOptionsBuilder.addHideFrom(builder);
    },
  });
