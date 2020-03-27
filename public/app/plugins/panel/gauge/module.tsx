import { PanelPlugin } from '@grafana/data';
import { GaugePanelEditor } from './GaugePanelEditor';
import { GaugePanel } from './GaugePanel';
import { GaugeOptions, defaults } from './types';
import { standardFieldConfig, addStandardSingleValueOptions } from '../stat/types';
import { gaugePanelMigrationHandler, gaugePanelChangedHandler } from './GaugeMigrations';

export const plugin = new PanelPlugin<GaugeOptions>(GaugePanel)
  .setDefaults(defaults)
  .setFieldConfigDefaults(standardFieldConfig)
  .setEditor(GaugePanelEditor)
  .setPanelOptions(builder => {
    addStandardSingleValueOptions(builder);
  })
  .setPanelChangeHandler(gaugePanelChangedHandler)
  .setMigrationHandler(gaugePanelMigrationHandler);
