import { sharedSingleStatMigrationHandler, sharedSingleStatPanelChangedHandler } from '@grafana/ui';
import { PanelPlugin } from '@grafana/data';
import { StatPanelOptions, defaults } from './types';
import { StatPanel } from './StatPanel';
import { StatPanelEditor } from './StatPanelEditor';

export const plugin = new PanelPlugin<StatPanelOptions>(StatPanel)
  .setDefaults(defaults)
  .setEditor(StatPanelEditor)
  .setNoPadding()
  .setPanelChangeHandler(sharedSingleStatPanelChangedHandler)
  .setMigrationHandler(sharedSingleStatMigrationHandler);
