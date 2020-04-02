import { sharedSingleStatMigrationHandler, sharedSingleStatPanelChangedHandler } from '@grafana/ui';
import { PanelPlugin } from '@grafana/data';
import { StatPanelOptions, defaults, addStandardDataReduceOptions } from './types';
import { StatPanel } from './StatPanel';
import { StatPanelEditor } from './StatPanelEditor';

export const plugin = new PanelPlugin<StatPanelOptions>(StatPanel)
  .setDefaults(defaults)
  .setEditor(StatPanelEditor)
  .setFieldConfigOptions()
  .setPanelOptions(builder => {
    addStandardDataReduceOptions(builder);

    builder
      .addRadio({
        id: 'colorMode',
        name: 'Color mode',
        description: 'Color either the value or the background',
        settings: {
          options: [
            { value: 'value', label: 'Value' },
            { value: 'background', label: 'Background' },
          ],
        },
      })
      .addRadio({
        id: 'graphMode',
        name: 'Graph mode',
        description: 'Stat panel graph / sparkline mode',
        settings: {
          options: [
            { value: 'none', label: 'None' },
            { value: 'area', label: 'Area' },
          ],
        },
      })
      .addRadio({
        id: 'justifyMode',
        name: 'Justify mode',
        description: 'Value & title posititioning',
        settings: {
          options: [
            { value: 'auto', label: 'Auto' },
            { value: 'center', label: 'Center' },
          ],
        },
      });
  })
  .setNoPadding()
  .setPanelChangeHandler(sharedSingleStatPanelChangedHandler)
  .setMigrationHandler(sharedSingleStatMigrationHandler);
