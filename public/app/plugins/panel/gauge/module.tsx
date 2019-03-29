import { ReactPanelPlugin, sharedSingleStatMigrationCheck, sharedSingleStatOptionsCheck } from '@grafana/ui';
import { GaugePanelEditor } from './GaugePanelEditor';
import { GaugePanel } from './GaugePanel';
import { GaugeOptions, defaults } from './types';

export const reactPanel = new ReactPanelPlugin<GaugeOptions>(GaugePanel)
  .setDefaults(defaults)
  .setEditor(GaugePanelEditor)
  .setPanelChangeHandler(sharedSingleStatOptionsCheck)
  .setMigrationHandler(sharedSingleStatMigrationCheck);
