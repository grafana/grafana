import {
  BigValueColorMode,
  BigValueTextMode,
  commonOptionsBuilder,
  sharedSingleStatMigrationHandler,
} from '@grafana/ui';
import { PanelPlugin } from '@grafana/data';
import { addOrientationOption, addStandardDataReduceOptions, StatPanelOptions } from './types';
import { StatPanel } from './StatPanel';
import { statPanelChangedHandler } from './StatMigrations';

export const plugin = new PanelPlugin<StatPanelOptions>(StatPanel)
  .useFieldConfig()
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
      defaultValue: 'auto',
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
        defaultValue: 'area',
        settings: {
          options: [
            { value: 'none', label: 'None' },
            { value: 'area', label: 'Area' },
          ],
        },
      })
      .addRadio({
        path: 'justifyMode',
        name: 'Text alignment',
        defaultValue: 'auto',
        category: mainCategory,
        settings: {
          options: [
            { value: 'auto', label: 'Auto' },
            { value: 'center', label: 'Center' },
          ],
        },
      });
  })
  .setNoPadding()
  .setPanelChangeHandler(statPanelChangedHandler)
  .setMigrationHandler(sharedSingleStatMigrationHandler);
