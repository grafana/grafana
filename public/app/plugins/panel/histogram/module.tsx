import {
  FieldColorModeId,
  FieldConfigProperty,
  FieldType,
  identityOverrideProcessor,
  PanelPlugin,
} from '@grafana/data';
import { histogramFieldInfo } from '@grafana/data/src/transformations/transformers/histogram';
import { commonOptionsBuilder, graphFieldOptions } from '@grafana/ui';
import { StackingEditor } from '@grafana/ui/src/options/builder';

import { HistogramPanel } from './HistogramPanel';
import { defaultHistogramConfig } from './config';
import { changeToHistogramPanelMigrationHandler } from './migrations';
import { FieldConfig, Options, defaultFieldConfig, defaultOptions } from './panelcfg.gen';
import { originalDataHasHistogram } from './utils';

export const plugin = new PanelPlugin<Options, FieldConfig>(HistogramPanel)
  .setPanelChangeHandler(changeToHistogramPanelMigrationHandler)
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
        path: 'bucketCount',
        name: histogramFieldInfo.bucketCount.name,
        description: histogramFieldInfo.bucketCount.description,
        settings: {
          placeholder: `Default: ${defaultOptions.bucketCount}`,
          min: 0,
        },
        showIf: (opts, data) => !originalDataHasHistogram(data),
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
          placeholder: `Default: ${defaultOptions.bucketOffset}`,
          min: 0,
        },
        showIf: (opts, data) => !originalDataHasHistogram(data),
      })
      .addBooleanSwitch({
        path: 'combine',
        name: histogramFieldInfo.combine.name,
        description: histogramFieldInfo.combine.description,
        defaultValue: defaultOptions.combine,
        showIf: (opts, data) => !originalDataHasHistogram(data),
      });

    commonOptionsBuilder.addTooltipOptions(builder);
    commonOptionsBuilder.addLegendOptions(builder);
  })
  .useFieldConfig({
    standardOptions: {
      [FieldConfigProperty.Color]: {
        settings: {
          byValueSupport: false,
          bySeriesSupport: true,
          preferThresholdsMode: false,
        },
        defaultValue: {
          mode: FieldColorModeId.PaletteClassic,
        },
      },
      [FieldConfigProperty.Links]: {
        settings: {
          showOneClick: true,
        },
      },
    },
    useCustomConfig: (builder) => {
      const cfg = defaultFieldConfig;

      builder
        .addCustomEditor({
          id: 'stacking',
          path: 'stacking',
          name: 'Stacking',
          category: ['Histogram'],
          defaultValue: defaultHistogramConfig.stacking,
          editor: StackingEditor,
          override: StackingEditor,
          settings: {
            options: graphFieldOptions.stacking,
          },
          process: identityOverrideProcessor,
          shouldApply: (f) => f.type === FieldType.number,
          showIf: (opts, data) => !originalDataHasHistogram(data),
        })
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
