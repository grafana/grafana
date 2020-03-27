import { sharedSingleStatMigrationHandler, sharedSingleStatPanelChangedHandler } from '@grafana/ui';
import { PanelPlugin } from '@grafana/data';
import { StatPanelOptions, defaults, standardFieldConfig, addStandardSingleValueOptions } from './types';
import { StatPanel } from './StatPanel';
import { StatPanelEditor } from './StatPanelEditor';

export const plugin = new PanelPlugin<StatPanelOptions>(StatPanel)
  .setDefaults(defaults)
  .setFieldConfigDefaults(standardFieldConfig)
  .setEditor(StatPanelEditor)
  .setPanelOptions(builder => {
    addStandardSingleValueOptions(builder);

    builder
      .addRadio({
        id: 'orientation',
        name: 'Orientation',
        description: 'Stacking direction for multiple bars',
        settings: {
          options: [
            { value: 'auto', label: 'Auto' },
            { value: 'horizontal', label: 'Horizontal' },
            { value: 'vertical', label: 'Vertical' },
          ],
        },
      })
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
