import { type PanelModel, type PanelTypeChangedHandler } from '@grafana/data';
import { FieldColorModeId } from '@grafana/schema';
import { sharedSingleStatPanelChangedHandler, sharedSingleStatMigrationHandler } from '@grafana/ui';

import { type FieldConfig, type Options } from './panelcfg.gen';

// This is called when the panel first loads
export function gaugePanelMigrationHandler(panel: PanelModel<Options>): Partial<Options> {
  const sharedOptions = sharedSingleStatMigrationHandler(panel);
  const newOptions: Partial<Options> = { ...sharedOptions };

  migrateNeutralToFieldConfig(panel, newOptions);

  if (shouldMigrateGauge(panel)) {
    const fieldConfig = panel.fieldConfig;

    // This option had no effect in old gauge unless color mode was 'From thresholds'
    if (newOptions.showThresholdMarkers && fieldConfig?.defaults?.color?.mode !== FieldColorModeId.Thresholds) {
      newOptions.showThresholdMarkers = false;
    }

    // This option is enabled by default in new gauge but does not exist in old gauge
    newOptions.sparkline = false;
    newOptions.effects = { gradient: false };

    // if a display name is set, set the appropriate text mode
    if ('displayName' in newOptions && newOptions.displayName && newOptions.displayName !== '') {
      newOptions.textMode = 'value_and_name';
    }

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

// Neutral used to be a panel option. It is now a field config option so that it can be set from query results.
function hasLegacyNeutralOption(panel: PanelModel): boolean {
  return typeof panel.options?.neutral === 'number';
}

function migrateNeutralToFieldConfig(panel: PanelModel, newOptions: Partial<Options>) {
  if (!hasLegacyNeutralOption(panel)) {
    return;
  }

  const legacyNeutral: number = panel.options.neutral;
  // neutral is no longer part of Options, so it has to be removed through an untyped view
  delete (newOptions as Record<string, unknown>).neutral;

  const fieldConfig = panel.fieldConfig ?? { defaults: {}, overrides: [] };
  const custom: FieldConfig = fieldConfig.defaults.custom ?? {};

  if (custom.neutral === undefined) {
    panel.fieldConfig = {
      ...fieldConfig,
      defaults: { ...fieldConfig.defaults, custom: { ...custom, neutral: legacyNeutral } },
    };
  }
}

export function shouldRunGaugeMigration(panel: PanelModel): boolean {
  return shouldMigrateGauge(panel) || hasLegacyNeutralOption(panel);
}

export function shouldMigrateGauge(panel: PanelModel): boolean {
  // Test for new gauge option
  if (panel.options?.shape) {
    return false;
  }

  const previousVersion = parseFloat(panel.pluginVersion ?? '8');
  return previousVersion < 13;
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
