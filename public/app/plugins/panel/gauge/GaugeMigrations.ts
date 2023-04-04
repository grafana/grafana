import { PanelModel } from '@grafana/data';
import { sharedSingleStatPanelChangedHandler, sharedSingleStatMigrationHandler } from '@grafana/ui';

import { PanelOptions } from './panelcfg.gen';

// This is called when the panel first loads
export const gaugePanelMigrationHandler = (panel: PanelModel<PanelOptions>): Partial<PanelOptions> => {
  return sharedSingleStatMigrationHandler(panel);
};

// This is called when the panel changes from another panel
export const gaugePanelChangedHandler = (
  panel: PanelModel<Partial<PanelOptions>>,
  prevPluginId: string,
  prevOptions: any
) => {
  // This handles most config changes
  const opts: PanelOptions = sharedSingleStatPanelChangedHandler(panel, prevPluginId, prevOptions);

  // Changing from angular singlestat
  if (prevPluginId === 'singlestat' && prevOptions.angular) {
    const gauge = prevOptions.angular.gauge;
    if (gauge) {
      opts.showThresholdMarkers = gauge.thresholdMarkers;
      opts.showThresholdLabels = gauge.thresholdLabels;
    }
  }
  return opts;
};
