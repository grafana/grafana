import { sharedSingleStatMigrationHandler, sharedSingleStatPanelChangedHandler } from '@grafana/ui';
import { PanelPlugin, ThresholdsMode } from '@grafana/data';
import { StatPanelOptions, defaults } from './types';
import { StatPanel } from './StatPanel';
import { StatPanelEditor } from './StatPanelEditor';

export const plugin = new PanelPlugin<StatPanelOptions>(StatPanel)
  .setDefaults(defaults)
  .setFieldConfigDefaults({
    thresholds: {
      mode: ThresholdsMode.Absolute,
      steps: [
        { value: -Infinity, color: 'green' },
        { value: 80, color: 'red' }, // 80%
      ],
    },
    mappings: [],
  })
  .setEditor(StatPanelEditor)
  .setNoPadding()
  .setPanelChangeHandler(sharedSingleStatPanelChangedHandler)
  .setMigrationHandler(sharedSingleStatMigrationHandler);
