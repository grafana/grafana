import { PanelPlugin } from '@grafana/data';
import { BigValueColorMode, BigValueGraphMode, BigValueJustifyMode, BigValueTextMode } from '@grafana/schema';
import { commonOptionsBuilder, sharedSingleStatMigrationHandler } from '@grafana/ui';

import { statPanelChangedHandler } from './StatMigrations';
import { StatPanel } from './StatPanel';
import { addStandardDataReduceOptions, addOrientationOption, getSymbolsToPrepend } from './common';
import { defaultPanelOptions, PanelOptions } from './panelcfg.gen';
import { StatSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin<PanelOptions>(StatPanel)
  .useFieldConfig({
    useCustomConfig(builder) {
      return builder.addSelect({
        path: 'prependUnit',
        name: 'Prepend common unit',
        description: 'Prepend a common unit along with standard formatting options',
        category: ['Stat-specific unit formatting options'],
        settings: {
          options: getSymbolsToPrepend(),
        },
        defaultValue: '',
      });
    },
  })
  .setPanelOptions((builder) => {
    const mainCategory = ['Stat styles'];

    addStandardDataReduceOptions(builder);
    addOrientationOption(builder, mainCategory);
    commonOptionsBuilder.addTextSizeOptions(builder);

    builder.addSelect({
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
      defaultValue: defaultPanelOptions.textMode,
    });

    builder
      .addRadio({
        path: 'colorMode',
        name: 'Color mode',
        defaultValue: BigValueColorMode.Value,
        category: mainCategory,
        settings: {
          options: [
            { value: BigValueColorMode.None, label: 'None' },
            { value: BigValueColorMode.Value, label: 'Value' },
            { value: BigValueColorMode.Background, label: 'Background' },
          ],
        },
      })
      .addRadio({
        path: 'graphMode',
        name: 'Graph mode',
        description: 'Stat panel graph / sparkline mode',
        category: mainCategory,
        defaultValue: defaultPanelOptions.graphMode,
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
        defaultValue: defaultPanelOptions.justifyMode,
        category: mainCategory,
        settings: {
          options: [
            { value: BigValueJustifyMode.Auto, label: 'Auto' },
            { value: BigValueJustifyMode.Center, label: 'Center' },
          ],
        },
      });

    // builder.addSelect({
    //   path: 'prependUnit',
    //   name: 'Prepend unit',
    //   description: 'Prepend a common unit along with standard formatting options',
    //   category: ['Prepend unit'],
    //   settings: {
    //     options: getSymbolsToPrepend(),
    //   },
    //   defaultValue: '',
    // });
  })
  .setNoPadding()
  .setPanelChangeHandler(statPanelChangedHandler)
  .setSuggestionsSupplier(new StatSuggestionsSupplier())
  .setMigrationHandler(sharedSingleStatMigrationHandler);
