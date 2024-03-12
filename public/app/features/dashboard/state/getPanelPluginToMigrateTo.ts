import config from 'app/core/config';

import { autoMigrateRemovedPanelPlugins, autoMigrateAngular } from './PanelModel';

export function getPanelPluginToMigrateTo(panel: any, forceMigration?: boolean): string | undefined {
  if (autoMigrateRemovedPanelPlugins[panel.type]) {
    return autoMigrateRemovedPanelPlugins[panel.type];
  }

  // Auto-migrate old angular panels
  const shouldMigrateAllAngularPanels =
    forceMigration || !config.angularSupportEnabled || config.featureToggles.autoMigrateOldPanels;

  // Graph needs special logic as it can be migrated to multiple panels
  if (panel.type === 'graph' && (shouldMigrateAllAngularPanels || config.featureToggles.autoMigrateGraphPanel)) {
    if (panel.xaxis?.mode === 'series') {
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

  if (panel.type === 'table-old' && config.featureToggles.autoMigrateTablePanel) {
    return 'table';
  }

  if (panel.type === 'grafana-piechart-panel' && config.featureToggles.autoMigratePiechartPanel) {
    return 'piechart';
  }

  if (panel.type === 'grafana-worldmap-panel' && config.featureToggles.autoMigrateWorldmapPanel) {
    return 'geomap';
  }

  if (
    (panel.type === 'singlestat' || panel.type === 'grafana-singlestat-panel') &&
    config.featureToggles.autoMigrateStatPanel
  ) {
    return 'stat';
  }

  return undefined;
}
