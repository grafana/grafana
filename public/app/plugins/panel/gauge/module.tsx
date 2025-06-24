import { PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';
import { BarGaugeSizing, VizOrientation } from '@grafana/schema';
import { commonOptionsBuilder } from '@grafana/ui';

import { addOrientationOption, addStandardDataReduceOptions } from '../stat/common';

import { gaugePanelMigrationHandler, gaugePanelChangedHandler } from './GaugeMigrations';
import { GaugePanel } from './GaugePanel';
import { Options, defaultOptions } from './panelcfg.gen';
import { GaugeSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin<Options>(GaugePanel)
  .useFieldConfig({
    useCustomConfig: (builder) => {
      builder.addNumberInput({
        path: 'neutral',
        name: t('gauge.name-neutral', 'Neutral'),
        description: t('gauge.description-neutral', 'Leave empty to use Min as neutral point'),
        category: [t('gauge.category-gauge', 'Gauge')],
        settings: {
          placeholder: t('gauge.placeholder-neutral', 'auto'),
        },
      });
    },
  })
  .setPanelOptions((builder) => {
    const category = [t('gauge.category-gauge', 'Gauge')];
    addStandardDataReduceOptions(builder);
    addOrientationOption(builder, category);
    builder
      .addBooleanSwitch({
        path: 'showThresholdLabels',
        name: t('gauge.name-show-threshold-labels', 'Show threshold labels'),
        description: t('gauge.description-show-threshold-labels', 'Render the threshold values around the gauge bar'),
        category,
        defaultValue: defaultOptions.showThresholdLabels,
      })
      .addBooleanSwitch({
        path: 'showThresholdMarkers',
        name: t('gauge.name-show-threshold-markers', 'Show threshold markers'),
        description: t('gauge.description-show-threshold-markers', 'Renders the thresholds as an outer bar'),
        category,
        defaultValue: defaultOptions.showThresholdMarkers,
      })
      .addRadio({
        path: 'sizing',
        name: t('gauge.name-gauge-size', 'Gauge size'),
        settings: {
          options: [
            { value: BarGaugeSizing.Auto, label: t('gauge.gauge-size-options.label-auto', 'Auto') },
            { value: BarGaugeSizing.Manual, label: t('gauge.gauge-size-options.label-manual', 'Manual') },
          ],
        },
        category,
        defaultValue: defaultOptions.sizing,
        showIf: (options: Options) => options.orientation !== VizOrientation.Auto,
      })
      .addSliderInput({
        path: 'minVizWidth',
        name: t('gauge.name-min-width', 'Min width'),
        description: t('gauge.description-min-width', 'Minimum column width (vertical orientation)'),
        defaultValue: defaultOptions.minVizWidth,
        settings: {
          min: 0,
          max: 600,
          step: 1,
        },
        category,
        showIf: (options: Options) =>
          options.sizing === BarGaugeSizing.Manual && options.orientation === VizOrientation.Vertical,
      })
      .addSliderInput({
        path: 'minVizHeight',
        name: t('gauge.name-min-height', 'Min height'),
        description: t('gauge.description-min-height', 'Minimum row height (horizontal orientation)'),
        defaultValue: defaultOptions.minVizHeight,
        category,
        settings: {
          min: 0,
          max: 600,
          step: 1,
        },
        showIf: (options: Options) =>
          options.sizing === BarGaugeSizing.Manual && options.orientation === VizOrientation.Horizontal,
      });

    commonOptionsBuilder.addTextSizeOptions(builder);
  })
  .setPanelChangeHandler(gaugePanelChangedHandler)
  .setSuggestionsSupplier(new GaugeSuggestionsSupplier())
  .setMigrationHandler(gaugePanelMigrationHandler);
