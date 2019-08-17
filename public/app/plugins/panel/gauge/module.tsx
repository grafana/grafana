import { PanelPlugin, sharedSingleStatOptionsCheck } from '@grafana/ui';
import { GaugePanelEditor } from './GaugePanelEditor';
import { GaugePanel } from './GaugePanel';
import { GaugeOptions, defaults } from './types';
import { gaugePanelMigrationCheck } from './GaugeMigrations';

export const plugin = new PanelPlugin<GaugeOptions>(GaugePanel)
  .setDefaults(defaults)
  .setEditor(GaugePanelEditor)
  .setPanelChangeHandler(sharedSingleStatOptionsCheck)
  .setMigrationHandler(gaugePanelMigrationCheck);
