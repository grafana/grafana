import { ReactPanelPlugin, sharedSingleStatMigrationCheck, sharedSingleStatOptionsCheck } from '@grafana/ui';
import { SingleStatOptions, defaults } from './types';
import { SingleStatPanel } from './SingleStatPanel';
import { SingleStatEditor } from './SingleStatEditor';

export const reactPanel = new ReactPanelPlugin<SingleStatOptions>(SingleStatPanel)
  .setDefaults(defaults)
  .setEditor(SingleStatEditor)
  .setPanelChangeHandler(sharedSingleStatOptionsCheck)
  .setMigrationHandler(sharedSingleStatMigrationCheck);
