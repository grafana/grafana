import {
  FieldColorModeId,
  FieldConfigProperty,
  FieldType,
  identityOverrideProcessor,
  PanelPlugin,
  histogramFieldInfo,
} from '@grafana/data';
import {
  defaultHistogramConfig,
  changeToHistogramPanelMigrationHandler,
  originalDataHasHistogram,
} from '@grafana/histogram';
import { t } from '@grafana/i18n';
import { commonOptionsBuilder, getGraphFieldOptions } from '@grafana/ui';
import { StackingEditor } from '@grafana/ui/internal';

import { HistogramPanel } from './HistogramPanel';
import { FieldConfig, Options, defaultFieldConfig, defaultOptions } from './panelcfg.gen';

export const plugin = new PanelPlugin<Options, FieldConfig>(HistogramPanel)
  .setPanelChangeHandler(changeToHistogramPanelMigrationHandler)
  .setPanelOptions((builder) => {
    const category = [t('histogram.category-histogram', 'Histogram')];
    builder
      .addCustomEditor({
        id: '__calc__',
        path: '__calc__',
        name: 'Values',
        category,
        description: 'Showing frequencies that are calculated in the query',
        editor: () => null, // empty editor
        showIf: (opts, data) => originalDataHasHistogram(data),
      })
      .addNumberInput({
        path: 'bucketCount',
        name: histogramFieldInfo.bucketCount.name,
        category,
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
        category,
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
        category,
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
        category,
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
      const graphFieldOptions = getGraphFieldOptions();
      const category = [t('histogram.category-histogram', 'Histogram')];

      builder
        .addCustomEditor({
          id: 'stacking',
          path: 'stacking',
          name: t('histogram.name-stacking', 'Stacking'),
          category,
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
          name: t('histogram.name-line-width', 'Line width'),
          category,
          defaultValue: cfg.lineWidth,
          settings: {
            min: 0,
            max: 10,
            step: 1,
          },
        })
        .addSliderInput({
          path: 'fillOpacity',
          name: t('histogram.name-fill-opacity', 'Fill opacity'),
          category,
          defaultValue: cfg.fillOpacity,
          settings: {
            min: 0,
            max: 100,
            step: 1,
          },
        })
        .addRadio({
          path: 'gradientMode',
          name: t('histogram.name-gradient-mode', 'Gradient mode'),
          category,
          defaultValue: graphFieldOptions.fillGradient[0].value,
          settings: {
            options: graphFieldOptions.fillGradient,
          },
        });

      commonOptionsBuilder.addHideFrom(builder);
    },
  });
