import { PanelModel as PanelModelFromData, PanelPlugin } from '@grafana/data';
import { autoMigrateAngular, PanelModel } from 'app/features/dashboard/state/PanelModel';

export function getAngularPanelMigrationHandler(oldModel: PanelModel) {
  return function handleAngularPanelMigrations(panel: PanelModelFromData, plugin: PanelPlugin) {
    if (plugin.angularPanelCtrl) {
      panel.options = { angularOptions: oldModel.getOptionsToRemember() };
      return;
    }

    if (oldModel.autoMigrateFrom) {
      const wasAngular = autoMigrateAngular[oldModel.autoMigrateFrom] != null;
      const oldOptions = oldModel.getOptionsToRemember();
      const prevPluginId = oldModel.autoMigrateFrom;

      if (plugin.onPanelTypeChanged) {
        const prevOptions = wasAngular ? { angular: oldOptions } : oldOptions.options;
        Object.assign(panel.options, plugin.onPanelTypeChanged(panel, prevPluginId, prevOptions, panel.fieldConfig));
      }
    }
  };
}
