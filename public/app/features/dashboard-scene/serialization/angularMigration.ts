import { defaults, cloneDeep } from 'lodash';

import { PanelModel as PanelModelFromData, PanelPlugin } from '@grafana/data';
import { autoMigrateAngular, PanelModel } from 'app/features/dashboard/state/PanelModel';

export function getAngularPanelMigrationHandler(oldModel: PanelModel) {
  return function handleAngularPanelMigrations(panel: PanelModelFromData, plugin: PanelPlugin) {
    if (plugin.angularPanelCtrl) {
      panel.options = { angularOptions: oldModel.getOptionsToRemember() };
      return;
    }

    if (!oldModel.options || Object.keys(oldModel.options).length === 0) {
      defaults(panel, oldModel.getOptionsToRemember());

      // Some plugins rely on being able to access targets to set up the fieldConfig when migrating from angular.
      const targetClone = cloneDeep(oldModel.targets);
      Object.defineProperty(panel, 'targets', {
        get: function () {
          console.warn(
            'Accessing the targets property when migrating a panel plugin is deprecated. Changes to this property will be ignored.'
          );
          return targetClone;
        },
      });
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
