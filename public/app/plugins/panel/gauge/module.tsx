import { VizPanelPlugin, sharedSingleStatMigrationCheck, sharedSingleStatOptionsCheck } from '@grafana/ui';
import { GaugePanelEditor } from './GaugePanelEditor';
import { GaugePanel } from './GaugePanel';
import { GaugeOptions, defaults } from './types';

export const plugin = new VizPanelPlugin<GaugeOptions>(GaugePanel)
  .setDefaults(defaults)
  .setEditor(GaugePanelEditor)
  .setPanelChangeHandler(sharedSingleStatOptionsCheck)
  .setMigrationHandler(sharedSingleStatMigrationCheck);
