import { PanelPlugin } from '@grafana/data';
import { GaugePanelEditor } from './GaugePanelEditor';
import { GaugePanel } from './GaugePanel';
import { GaugeOptions, defaults } from './types';
import { addStandardDataReduceOptions } from '../stat/types';
import { gaugePanelMigrationHandler, gaugePanelChangedHandler } from './GaugeMigrations';

export const plugin = new PanelPlugin<GaugeOptions>(GaugePanel)
  .setDefaults(defaults)
  .setEditor(GaugePanelEditor)
  .setPanelOptions(builder => {
    addStandardDataReduceOptions(builder);

    builder
      .addBooleanSwitch({
        id: 'showThresholdLabels',
        name: 'Show threshold Labels',
        description: 'Render the threshold values around the gauge bar',
      })
      .addBooleanSwitch({
        id: 'showThresholdMarkers',
        name: 'Show threshold markers',
        description: 'Renders the thresholds as an outer bar',
      });
  })
  .setPanelChangeHandler(gaugePanelChangedHandler)
  .setMigrationHandler(gaugePanelMigrationHandler)
  .useStandardFieldConfig();
