import { PanelModel, PanelTypeChangedHandler } from '@grafana/data';
import { FieldColorModeId } from '@grafana/schema/dist/esm/index.gen';
import { sharedSingleStatPanelChangedHandler, sharedSingleStatMigrationHandler } from '@grafana/ui';

import { Options } from './panelcfg.gen';

// This is called when the panel first loads
export function gaugePanelMigrationHandler(panel: PanelModel<Options>): Partial<Options> {
  const sharedOptions = sharedSingleStatMigrationHandler(panel);
  const newOptions: Partial<Options> = { ...sharedOptions };

  const previousVersion = parseFloat(panel.pluginVersion || '8');
  const fieldConfig = panel.fieldConfig;

  if (previousVersion <= 12.3) {
    // This option had no effect in old gauge unless color mode was 'From thresholds'
    if (newOptions.showThresholdMarkers && fieldConfig?.defaults?.color?.mode !== FieldColorModeId.Thresholds) {
      newOptions.showThresholdMarkers = false;
    }

    // This option is enabled by default in new gauge but does not exist in old gauge
    newOptions.sparkline = false;
    newOptions.gradient = 'none';

    // Remove deprecated sizing options
    if ('sizing' in newOptions) {
      delete newOptions.sizing;
    }

    if ('minVizHeight' in newOptions) {
      delete newOptions.minVizHeight;
    }

    if ('minVizWidth' in newOptions) {
      delete newOptions.minVizWidth;
    }
  }

  return newOptions;
}

export function shouldMigrateGauge(panel: PanelModel): boolean {
  const previousVersion = parseFloat(panel.pluginVersion ?? '8');
  return previousVersion <= 12.3;
}

// This is called when the panel changes from another panel
export const gaugePanelChangedHandler: PanelTypeChangedHandler<Options> = (
  panel,
  prevPluginId: string,
  prevOptions
) => {
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
};
