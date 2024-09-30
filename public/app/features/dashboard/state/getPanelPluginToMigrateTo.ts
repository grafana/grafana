import config from 'app/core/config';

import { autoMigrateRemovedPanelPlugins, autoMigrateAngular } from './PanelModel';

export function getPanelPluginToMigrateTo(panel: any, forceMigration?: boolean): string | undefined {
  if (autoMigrateRemovedPanelPlugins[panel.type]) {
    return autoMigrateRemovedPanelPlugins[panel.type];
  }

  const isUrlFeatureFlagEnabled = (featureName: string) => {
    const flag = '__feature.' + featureName;

    const urlParams = new URLSearchParams(window.location.search);
    const featureFlagValue = urlParams.get(flag);

    return featureFlagValue === 'true' || featureFlagValue === '';
  };

  // Auto-migrate old angular panels
  const shouldMigrateAllAngularPanels =
    forceMigration ||
    !config.angularSupportEnabled ||
    config.featureToggles.autoMigrateOldPanels ||
    isUrlFeatureFlagEnabled('autoMigrateOldPanels') ||
    isUrlFeatureFlagEnabled('disableAngular');

  // Graph needs special logic as it can be migrated to multiple panels
  if (
    panel.type === 'graph' &&
    (shouldMigrateAllAngularPanels ||
      config.featureToggles.autoMigrateGraphPanel ||
      isUrlFeatureFlagEnabled('autoMigrateGraphPanel'))
  ) {
    if (panel.xaxis?.mode === 'series') {
      if (panel.legend?.values) {
        return 'bargauge';
      }

      return 'barchart';
    }

    if (panel.xaxis?.mode === 'histogram') {
      return 'histogram';
    }

    return 'timeseries';
  }

  if (shouldMigrateAllAngularPanels) {
    return autoMigrateAngular[panel.type];
  }

  if (
    panel.type === 'table-old' &&
    (config.featureToggles.autoMigrateTablePanel || isUrlFeatureFlagEnabled('autoMigrateTablePanel'))
  ) {
    return 'table';
  }

  if (
    panel.type === 'grafana-piechart-panel' &&
    (config.featureToggles.autoMigratePiechartPanel || isUrlFeatureFlagEnabled('autoMigratePiechartPanel'))
  ) {
    return 'piechart';
  }

  if (
    panel.type === 'grafana-worldmap-panel' &&
    (config.featureToggles.autoMigrateWorldmapPanel || isUrlFeatureFlagEnabled('autoMigrateWorldmapPanel'))
  ) {
    return 'geomap';
  }

  if (
    ((panel.type === 'singlestat' || panel.type === 'grafana-singlestat-panel') &&
      config.featureToggles.autoMigrateStatPanel) ||
    isUrlFeatureFlagEnabled('autoMigrateStatPanel')
  ) {
    return 'stat';
  }

  return undefined;
}
