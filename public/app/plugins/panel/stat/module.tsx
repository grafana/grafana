import { PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  BigValueColorMode,
  BigValueGraphMode,
  BigValueJustifyMode,
  BigValueTextMode,
  PercentChangeColorMode,
} from '@grafana/schema';
import { commonOptionsBuilder, sharedSingleStatMigrationHandler } from '@grafana/ui';

import { statPanelChangedHandler } from './StatMigrations';
import { StatPanel } from './StatPanel';
import { addStandardDataReduceOptions, addOrientationOption } from './common';
import { defaultOptions, Options } from './panelcfg.gen';
import { StatSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin<Options>(StatPanel)
  .useFieldConfig()
  .setPanelOptions((builder) => {
    const mainCategory = [t('stat.category-stat-styles', 'Stat styles')];

    addStandardDataReduceOptions(builder);
    addOrientationOption(builder, mainCategory);
    commonOptionsBuilder.addTextSizeOptions(builder);

    builder
      .addSelect({
        path: 'textMode',
        name: t('stat.name-text-mode', 'Text mode'),
        description: t('stat.description-text-mode', 'Control if name and value is displayed or just name'),
        category: mainCategory,
        settings: {
          options: [
            { value: BigValueTextMode.Auto, label: t('stat.text-mode-options.label-auto', 'Auto') },
            { value: BigValueTextMode.Value, label: t('stat.text-mode-options.label-value', 'Value') },
            {
              value: BigValueTextMode.ValueAndName,
              label: t('stat.text-mode-options.label-value-and-name', 'Value and name'),
            },
            { value: BigValueTextMode.Name, label: t('stat.text-mode-options.label-name', 'Name') },
            { value: BigValueTextMode.None, label: t('stat.text-mode-options.label-none', 'None') },
          ],
        },
        defaultValue: defaultOptions.textMode,
      })
      .addRadio({
        path: 'wideLayout',
        name: t('stat.name-wide-layout', 'Wide layout'),
        category: mainCategory,
        settings: {
          options: [
            { value: true, label: t('stat.wide-layout-options.label-on', 'On') },
            { value: false, label: t('stat.wide-layout-options.label-off', 'Off') },
          ],
        },
        defaultValue: defaultOptions.wideLayout,
        showIf: (config) => config.textMode === BigValueTextMode.ValueAndName,
      });

    builder
      .addSelect({
        path: 'colorMode',
        name: t('stat.name-color-modcolor-mode-options.label', 'Color mode'),
        defaultValue: BigValueColorMode.Value,
        category: mainCategory,
        settings: {
          options: [
            { value: BigValueColorMode.None, label: t('stat.color-mode-options.label-none', 'None') },
            { value: BigValueColorMode.Value, label: t('stat.color-mode-options.label-value', 'Value') },
            {
              value: BigValueColorMode.Background,
              label: t('stat.color-mode-options.label-background-gradient', 'Background Gradient'),
            },
            {
              value: BigValueColorMode.BackgroundSolid,
              label: t('stat.color-mode-options.label-background-solid', 'Background Solid'),
            },
          ],
        },
      })
      .addRadio({
        path: 'graphMode',
        name: t('stat.name-graph-mode', 'Graph mode'),
        description: t('stat.description-graph-mode', 'Stat panel graph / sparkline mode'),
        category: mainCategory,
        defaultValue: defaultOptions.graphMode,
        settings: {
          options: [
            { value: BigValueGraphMode.None, label: t('stat.graph-mode.options.label-none', 'None') },
            { value: BigValueGraphMode.Area, label: t('stat.graph-mode.options.label-area', 'Area') },
          ],
        },
      })
      .addRadio({
        path: 'justifyMode',
        name: t('stat.name-text-alignment', 'Text alignment'),
        defaultValue: defaultOptions.justifyMode,
        category: mainCategory,
        settings: {
          options: [
            { value: BigValueJustifyMode.Auto, label: t('stat.text-alignment-options.label-auto', 'Auto') },
            { value: BigValueJustifyMode.Center, label: t('stat.text-alignment-options.label-center', 'Center') },
          ],
        },
      })
      .addBooleanSwitch({
        path: 'showPercentChange',
        name: t('stat.name-show-percent-change', 'Show percent change'),
        defaultValue: defaultOptions.showPercentChange,
        category: mainCategory,
        showIf: (config) => !config.reduceOptions.values,
      })
      .addSelect({
        path: 'percentChangeColorMode',
        name: t('stat.percent-change-color-mode', 'Percent change color mode'),
        defaultValue: defaultOptions.percentChangeColorMode,
        category: mainCategory,
        settings: {
          options: [
            {
              value: PercentChangeColorMode.Standard,
              label: t('stat.percent-change-color-mode-options.label-standard', 'Standard'),
            },
            {
              value: PercentChangeColorMode.Inverted,
              label: t('stat.percent-change-color-mode-options.label-inverted', 'Inverted'),
            },
            {
              value: PercentChangeColorMode.SameAsValue,
              label: t('stat.percent-change-color-mode-options.label-same-as-value', 'Same as Value'),
            },
          ],
        },
        showIf: (config) => config.showPercentChange,
      });
  })
  .setNoPadding()
  .setPanelChangeHandler(statPanelChangedHandler)
  .setSuggestionsSupplier(new StatSuggestionsSupplier())
  .setMigrationHandler(sharedSingleStatMigrationHandler);
