import { ReactPanelPlugin } from '@grafana/ui';

import { GaugePanelEditor } from './GaugePanelEditor';
import { GaugePanel } from './GaugePanel';
import { GaugeOptions, defaults } from './types';
import { singleStatBaseOptionsCheck, singleStatMigrationCheck } from '../singlestat2/module';

export const reactPanel = new ReactPanelPlugin<GaugeOptions>(GaugePanel)
  .setDefaults(defaults)
  .setEditor(GaugePanelEditor)
  .setPanelChangeHandler(singleStatBaseOptionsCheck)
  .setMigrationHandler(singleStatMigrationCheck);
