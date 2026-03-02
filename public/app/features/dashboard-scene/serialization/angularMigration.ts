import { defaults, cloneDeep } from 'lodash';

import { PanelModel as PanelModelFromData, PanelPlugin } from '@grafana/data';
import { autoMigrateAngular, PanelModel } from 'app/features/dashboard/state/PanelModel';

/**
 * Data structure for Angular migration information stored in v2 schema options.
 */
export interface AngularMigrationData {
  /** The original panel type before migration (e.g., "singlestat", "graph") */
  autoMigrateFrom: string;
  /** Angular-specific options not part of the Panel schema */
  originalOptions: Record<string, unknown>;
}

/**
 * Type guard to check if an unknown value is AngularMigrationData.
 */
export function isAngularMigrationData(value: unknown): value is AngularMigrationData {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (!('autoMigrateFrom' in value) || !('originalOptions' in value)) {
    return false;
  }

  const { autoMigrateFrom, originalOptions } = value;
  return typeof autoMigrateFrom === 'string' && typeof originalOptions === 'object';
}

export function getAngularPanelMigrationHandler(oldModel: PanelModel) {
  return function handleAngularPanelMigrations(panel: PanelModelFromData, plugin: PanelPlugin) {
    if ('angularPanelCtrl' in plugin && plugin.angularPanelCtrl) {
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

/**
 * Returns a migration handler for v2 schema panels that need Angular migrations.
 *
 * This is used when loading v2 dashboards that were converted from v1 and contain
 * __angularMigration data. The handler invokes the plugin's onPanelTypeChanged
 * to properly migrate options from the original Angular panel format.
 *
 * Example flow for singlestat -> stat:
 * 1. v0 -> v1 migration converts panel type from "singlestat" to "stat" and sets autoMigrateFrom="singlestat"
 *    (OR if dashboard was stored directly as v1 with "singlestat", the v1 -> v2 conversion does this)
 * 2. v1 -> v2 conversion detects autoMigrateFrom and stores Angular-specific options in options.__angularMigration
 * 3. Frontend loads v2 dashboard, extracts __angularMigration, and attaches this handler
 * 4. Handler calls stat plugin's onPanelTypeChanged with { angular: originalOptions }
 * 5. Plugin migrates format/valueName/etc to proper stat options
 *
 * For panels where autoMigrateFrom equals the current type (e.g., "text" -> "text"):
 * - These are panels with Angular-style properties at the root level (content, mode, etc.)
 * - We spread originalOptions onto the panel so the plugin's migration handler can see them
 * - This matches the v1 behavior where PanelModel.restoreModel() spreads all properties
 *
 * @param migrationData The __angularMigration data extracted from panel options
 */
export function getV2AngularMigrationHandler(migrationData: AngularMigrationData) {
  return function handleV2AngularMigration(panel: PanelModelFromData, plugin: PanelPlugin) {
    const { autoMigrateFrom, originalOptions } = migrationData;
    const wasAngular = autoMigrateAngular[autoMigrateFrom] != null;

    // Handle plugins that still use angularPanelCtrl
    if ('angularPanelCtrl' in plugin && plugin.angularPanelCtrl) {
      panel.options = { angularOptions: originalOptions };
      return;
    }

    // Spread originalOptions onto the panel object.
    // This is critical for plugins that use setMigrationHandler (like text panel) which expect
    // Angular properties (content, mode, etc.) to be directly on the panel object.
    // This matches the v1 behavior where PanelModel.restoreModel() spreads all JSON properties.
    if (originalOptions && Object.keys(originalOptions).length > 0) {
      defaults(panel, originalOptions);
    }

    // Some plugins rely on being able to access targets to set up the fieldConfig when migrating from angular.
    // Proxy the targets property with a deprecation warning.
    const targetClone = cloneDeep(panel.targets);
    Object.defineProperty(panel, 'targets', {
      get: function () {
        console.warn(
          'Accessing the targets property when migrating a panel plugin is deprecated. Changes to this property will be ignored.'
        );
        return targetClone;
      },
    });

    // For panels with onPanelTypeChanged (e.g., singlestat -> stat), call the handler
    if (plugin.onPanelTypeChanged) {
      // For Angular panels, wrap in { angular: ... } to match expected format
      // For React panels migrating from other React panels, pass options directly
      const prevOptions = wasAngular ? { angular: originalOptions } : { options: originalOptions };
      Object.assign(panel.options, plugin.onPanelTypeChanged(panel, autoMigrateFrom, prevOptions, panel.fieldConfig));
    }
  };
}
