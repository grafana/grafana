import { sharedSingleStatPanelChangedHandler, sharedSingleStatMigrationHandler } from '@grafana/ui';
import { PanelModel } from '@grafana/data';
import { GaugeOptions } from './types';

// This is called when the panel first loads
export const gaugePanelMigrationHandler = (panel: PanelModel<GaugeOptions>): Partial<GaugeOptions> => {
  return sharedSingleStatMigrationHandler(panel);
};

// This is called when the panel changes from another panel
export const gaugePanelChangedHandler = (
  options: Partial<GaugeOptions> | any,
  prevPluginId: string,
  prevOptions: any
) => {
  // This handles most config changes
  const opts = sharedSingleStatPanelChangedHandler(options, prevPluginId, prevOptions) as GaugeOptions;

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
