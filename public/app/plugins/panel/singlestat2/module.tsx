import { sharedSingleStatMigrationHandler, sharedSingleStatPanelChangedHandler } from '@grafana/ui';
import { PanelPlugin } from '@grafana/data';
import { SingleStatOptions, defaults } from './types';
import { SingleStatPanel } from './SingleStatPanel';
import { SingleStatEditor } from './SingleStatEditor';

export const plugin = new PanelPlugin<SingleStatOptions>(SingleStatPanel)
  .setDefaults(defaults)
  .setEditor(SingleStatEditor)
  .setPanelChangeHandler(sharedSingleStatPanelChangedHandler)
  .setMigrationHandler(sharedSingleStatMigrationHandler);
