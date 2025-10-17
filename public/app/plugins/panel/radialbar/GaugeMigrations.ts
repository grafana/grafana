import { PanelModel } from '@grafana/data';
import { sharedSingleStatPanelChangedHandler, sharedSingleStatMigrationHandler } from '@grafana/ui';

import { Options } from './panelcfg.gen';

// This is called when the panel first loads
export function gaugePanelMigrationHandler(panel: PanelModel<Options>): Partial<Options> {
  const options = sharedSingleStatMigrationHandler(panel);

  const previousVersion = parseFloat(panel.pluginVersion || '8');

  console.log('migration', panel);

  return options;
}

export function shouldMigrateGauge(panel: PanelModel): boolean {
  const previousVersion = parseFloat(panel.pluginVersion ?? '8');
  return previousVersion <= 12.3;
}

// This is called when the panel changes from another panel
export function gaugePanelChangedHandler(panel: PanelModel<Partial<Options>>, prevPluginId: string, prevOptions: any) {
  // This handles most config changes
  const opts: Options = sharedSingleStatPanelChangedHandler(panel, prevPluginId, prevOptions);

  // Changing from angular singlestat
  if (prevPluginId === 'singlestat' && prevOptions.angular) {
    const gauge = prevOptions.angular.gauge;
    if (gauge) {
      opts.showThresholdMarkers = gauge.thresholdMarkers;
      opts.showThresholdLabels = gauge.thresholdLabels;
    }
  }
  return opts;
}
