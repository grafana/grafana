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

    builder.addRadio({
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
    });
  })
  .setNoPadding()
  .setPanelChangeHandler(sharedSingleStatPanelChangedHandler)
  .setMigrationHandler(sharedSingleStatMigrationHandler);
