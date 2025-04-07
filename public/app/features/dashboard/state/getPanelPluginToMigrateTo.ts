import { autoMigrateRemovedPanelPlugins, autoMigrateAngular } from './PanelModel';

export function getPanelPluginToMigrateTo(panel: any): string | undefined {
  if (autoMigrateRemovedPanelPlugins[panel.type]) {
    return autoMigrateRemovedPanelPlugins[panel.type];
  }

  // Graph needs special logic as it can be migrated to multiple panels
  if (panel.type === 'graph') {
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

  return autoMigrateAngular[panel.type];
}
