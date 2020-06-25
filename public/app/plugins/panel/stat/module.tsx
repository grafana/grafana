import { sharedSingleStatMigrationHandler, BigValueTextMode } from '@grafana/ui';
import { PanelPlugin } from '@grafana/data';
import { StatPanelOptions, addStandardDataReduceOptions } from './types';
import { StatPanel } from './StatPanel';
import { statPanelChangedHandler } from './StatMigrations';

export const plugin = new PanelPlugin<StatPanelOptions>(StatPanel)
  .useFieldConfig()
  .setPanelOptions(builder => {
    addStandardDataReduceOptions(builder);

    builder.addSelect({
      path: 'textMode',
      name: 'Text mode',
      description: 'Control if name and value is displayed or just name',
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
        description: 'Color either the value or the background',
        defaultValue: 'value',
        settings: {
          options: [
            { value: 'value', label: 'Value' },
            { value: 'background', label: 'Background' },
          ],
        },
      })
      .addRadio({
        path: 'graphMode',
        name: 'Graph mode',
        description: 'Stat panel graph / sparkline mode',
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
        name: 'Alignment mode',
        description: 'Value & title posititioning',
        defaultValue: 'auto',
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
