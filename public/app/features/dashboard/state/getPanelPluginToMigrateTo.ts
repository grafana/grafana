import { autoMigrateAngular } from './PanelModel';

export function getPanelPluginToMigrateTo(panel: any): string | undefined {
  // Graph needs special logic as it can be migrated to multiple panels
  // Also, graphite was previously migrated to graph in the schema version 2 migration in DashboardMigrator.ts
  // but this was a bug because in there graphite was set to graph, but since those migrations run
  // after PanelModel.restoreModel where autoMigrateFrom is set, this caused the graph migration to be skipped.
  // And this resulted in a dashboard with invalid panels.
  if (panel.type === 'graph' || panel.type === 'graphite') {
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
