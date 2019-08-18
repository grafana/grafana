import { PanelModel, sharedSingleStatOptionsCheck, sharedSingleStatMigrationCheck } from '@grafana/ui';
import { GaugeOptions } from './types';

// This is called when the panel first loads
export const gaugePanelMigrationCheck = (panel: PanelModel<GaugeOptions>): Partial<GaugeOptions> => {
  return sharedSingleStatMigrationCheck(panel);
};

// This is called when the panel changes from another panel
export const gaugePanelChangedCheck = (
  options: Partial<GaugeOptions> | any,
  prevPluginId: string,
  prevOptions: any
) => {
  // This handles most config changes
  const opts = sharedSingleStatOptionsCheck(options, prevPluginId, prevOptions) as GaugeOptions;

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
