import { PanelPlugin } from '@grafana/data';
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
    const mainCategory = ['Stat styles'];

    addStandardDataReduceOptions(builder);
    addOrientationOption(builder, mainCategory);
    commonOptionsBuilder.addTextSizeOptions(builder);

    builder
      .addSelect({
        path: 'textMode',
        name: 'Text mode',
        description: 'Control if name and value is displayed or just name',
        category: mainCategory,
        settings: {
          options: [
            { value: BigValueTextMode.Auto, label: 'Auto' },
            { value: BigValueTextMode.Value, label: 'Value' },
            { value: BigValueTextMode.ValueAndName, label: 'Value and name' },
            { value: BigValueTextMode.Name, label: 'Name' },
            { value: BigValueTextMode.None, label: 'None' },
          ],
        },
        defaultValue: defaultOptions.textMode,
      })
      .addRadio({
        path: 'wideLayout',
        name: 'Wide layout',
        category: mainCategory,
        settings: {
          options: [
            { value: true, label: 'On' },
            { value: false, label: 'Off' },
          ],
        },
        defaultValue: defaultOptions.wideLayout,
        showIf: (config) => config.textMode === BigValueTextMode.ValueAndName,
      });

    builder
      .addSelect({
        path: 'colorMode',
        name: 'Color mode',
        defaultValue: BigValueColorMode.Value,
        category: mainCategory,
        settings: {
          options: [
            { value: BigValueColorMode.None, label: 'None' },
            { value: BigValueColorMode.Value, label: 'Value' },
            { value: BigValueColorMode.Background, label: 'Background Gradient' },
            { value: BigValueColorMode.BackgroundSolid, label: 'Background Solid' },
          ],
        },
      })
      .addRadio({
        path: 'graphMode',
        name: 'Graph mode',
        description: 'Stat panel graph / sparkline mode',
        category: mainCategory,
        defaultValue: defaultOptions.graphMode,
        settings: {
          options: [
            { value: BigValueGraphMode.None, label: 'None' },
            { value: BigValueGraphMode.Area, label: 'Area' },
          ],
        },
      })
      .addRadio({
        path: 'justifyMode',
        name: 'Text alignment',
        defaultValue: defaultOptions.justifyMode,
        category: mainCategory,
        settings: {
          options: [
            { value: BigValueJustifyMode.Auto, label: 'Auto' },
            { value: BigValueJustifyMode.Center, label: 'Center' },
          ],
        },
      })
      .addBooleanSwitch({
        path: 'showPercentChange',
        name: 'Show percent change',
        defaultValue: defaultOptions.showPercentChange,
        category: mainCategory,
        showIf: (config) => !config.reduceOptions.values,
      })
      .addSelect({
        path: 'percentChangeColorMode',
        name: 'Percent change color mode',
        defaultValue: defaultOptions.percentChangeColorMode,
        category: mainCategory,
        settings: {
          options: [
            { value: PercentChangeColorMode.Standard, label: 'Standard' },
            { value: PercentChangeColorMode.Inverted, label: 'Inverted' },
            { value: PercentChangeColorMode.SameAsValue, label: 'Same as Value' },
          ],
        },
        showIf: (config) => config.showPercentChange,
      });
  })
  .setNoPadding()
  .setPanelChangeHandler(statPanelChangedHandler)
  .setSuggestionsSupplier(new StatSuggestionsSupplier())
  .setMigrationHandler(sharedSingleStatMigrationHandler);
