import { PanelPlugin, VizOrientation } from '@grafana/data';
import { t } from '@grafana/i18n';
import { BarGaugeDisplayMode, BarGaugeNamePlacement, BarGaugeSizing, BarGaugeValueMode } from '@grafana/schema';
import { commonOptionsBuilder, sharedSingleStatPanelChangedHandler } from '@grafana/ui';

import { addOrientationOption, addStandardDataReduceOptions } from '../stat/common';

import { barGaugePanelMigrationHandler } from './BarGaugeMigrations';
import { BarGaugePanel } from './BarGaugePanel';
import { Options, defaultOptions } from './panelcfg.gen';
import { BarGaugeSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin<Options>(BarGaugePanel)
  .useFieldConfig()
  .setPanelOptions((builder) => {
    const category = [t('bargauge.category-bar-gauge', 'Bar gauge')];
    addStandardDataReduceOptions(builder);
    addOrientationOption(builder, category);
    commonOptionsBuilder.addLegendOptions(builder, true, false);
    commonOptionsBuilder.addTextSizeOptions(builder);

    builder
      .addRadio({
        path: 'displayMode',
        name: t('bargauge.name-display-mode', 'Display mode'),
        category,
        settings: {
          options: [
            {
              value: BarGaugeDisplayMode.Gradient,
              label: t('bargauge.display-mode-options.label-gradient', 'Gradient'),
            },
            { value: BarGaugeDisplayMode.Lcd, label: t('bargauge.display-mode-options.label-retro', 'Retro LCD') },
            { value: BarGaugeDisplayMode.Basic, label: t('bargauge.display-mode-options.label-basic', 'Basic') },
          ],
        },
        defaultValue: defaultOptions.displayMode,
      })
      .addRadio({
        path: 'valueMode',
        name: t('bargauge.name-value-display', 'Value display'),
        category,
        settings: {
          options: [
            {
              value: BarGaugeValueMode.Color,
              label: t('bargauge.value-display-options.label-value-color', 'Value color'),
            },
            {
              value: BarGaugeValueMode.Text,
              label: t('bargauge.value-display-options.label-text-color', 'Text color'),
            },
            { value: BarGaugeValueMode.Hidden, label: t('bargauge.value-display-options.label-hidden', 'Hidden') },
          ],
        },
        defaultValue: defaultOptions.valueMode,
      })
      .addRadio({
        path: 'namePlacement',
        name: t('bargauge.name-name-placement', 'Name placement'),
        category,
        settings: {
          options: [
            { value: BarGaugeNamePlacement.Auto, label: t('bargauge.name-placement-options.label-auto', 'Auto') },
            { value: BarGaugeNamePlacement.Top, label: t('bargauge.name-placement-options.label-top', 'Top') },
            { value: BarGaugeNamePlacement.Left, label: t('bargauge.name-placement-options.label-left', 'Left') },
            { value: BarGaugeNamePlacement.Hidden, label: t('bargauge.name-placement-options.label-hidden', 'Hidden') },
          ],
        },
        defaultValue: defaultOptions.namePlacement,
        showIf: (options) => options.orientation !== VizOrientation.Vertical,
      })
      .addRadio({
        path: 'namePlacement',
        name: t('bargauge.name-name-placement', 'Name placement'),
        category,
        settings: {
          options: [
            { value: BarGaugeNamePlacement.Auto, label: t('bargauge.name-placement-options.label-auto', 'Auto') },
            { value: BarGaugeNamePlacement.Hidden, label: t('bargauge.name-placement-options.label-hidden', 'Hidden') },
          ],
        },
        defaultValue: defaultOptions.namePlacement,
        showIf: (options) => options.orientation === VizOrientation.Vertical,
      })
      .addBooleanSwitch({
        path: 'showUnfilled',
        name: t('bargauge.name-show-unfilled-area', 'Show unfilled area'),
        category,
        description: t('bargauge.description-show-unfilled-area', 'When enabled renders the unfilled region as gray'),
        defaultValue: defaultOptions.showUnfilled,
        showIf: (options) => options.displayMode !== 'lcd',
      })
      .addRadio({
        path: 'sizing',
        name: t('bargauge.name-bar-size', 'Bar size'),
        category,
        settings: {
          options: [
            { value: BarGaugeSizing.Auto, label: t('bargauge.bar-size-options.label-auto', 'Auto') },
            { value: BarGaugeSizing.Manual, label: t('bargauge.bar-size-options.label-manual', 'Manual') },
          ],
        },
        defaultValue: defaultOptions.sizing,
      })
      .addSliderInput({
        path: 'minVizWidth',
        name: t('bargauge.name-min-width', 'Min width'),
        category,
        description: t('bargauge.description-min-width', 'Minimum column width (vertical orientation)'),
        defaultValue: defaultOptions.minVizWidth,
        settings: {
          min: 0,
          max: 300,
          step: 1,
        },
        showIf: (options) =>
          options.sizing === BarGaugeSizing.Manual &&
          (options.orientation === VizOrientation.Auto || options.orientation === VizOrientation.Vertical),
      })
      .addSliderInput({
        path: 'minVizHeight',
        name: t('bargauge.name-min-height', 'Min height'),
        category,
        description: t('bargauge.description-min-height', 'Minimum row height (horizontal orientation)'),
        defaultValue: defaultOptions.minVizHeight,
        settings: {
          min: 0,
          max: 300,
          step: 1,
        },
        showIf: (options) =>
          options.sizing === BarGaugeSizing.Manual &&
          (options.orientation === VizOrientation.Auto || options.orientation === VizOrientation.Horizontal),
      })
      .addSliderInput({
        path: 'maxVizHeight',
        name: t('bargauge.name-max-height', 'Max height'),
        category,
        description: t('bargauge.description-max-height', 'Maximum row height (horizontal orientation)'),
        defaultValue: defaultOptions.maxVizHeight,
        settings: {
          min: 0,
          max: 300,
          step: 1,
        },
        showIf: (options) =>
          options.sizing === BarGaugeSizing.Manual &&
          (options.orientation === VizOrientation.Auto || options.orientation === VizOrientation.Horizontal),
      });
  })
  .setPanelChangeHandler(sharedSingleStatPanelChangedHandler)
  .setMigrationHandler(barGaugePanelMigrationHandler)
  .setSuggestionsSupplier(new BarGaugeSuggestionsSupplier());
