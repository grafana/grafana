import { Dashboard } from '@grafana/schema/dist/esm/veneer/dashboard.types';

import { PanelModel } from './PanelModel';
import { getPanelPluginToMigrateTo } from './getPanelPluginToMigrateTo';

export function normalizeMigratedDashboard(frontendMigrationResult: Dashboard, backendMigrationResult: Dashboard) {
  // since we are initializing panels inside collapsed rows with PanelModel in transformSceneToSaveModel (see createRowItemFromLegacyRow)
  // and not in DashboardModel, this means that these panels will have automigratedFrom and panel type changed to the new panel type
  // backend matches this behaviour by setting up autoMigrateFrom and type for nested panels too
  // @ts-expect-error - we are using the type from the frontend migration result
  for (const panel of frontendMigrationResult.panels) {
    // if panel has an empty links array, just remove it
    // transformSceneToSaveModel sets empty links array to [] when no links are present
    if (panel instanceof PanelModel && panel.links?.length === 0) {
      delete panel.links;
    }

    // if panels has an empty options object, just remove it
    if (panel instanceof PanelModel && panel.options && Object.keys(panel.options).length === 0) {
      // @ts-expect-error - this type is required in PanelModel but it can be an empty object
      delete panel.options;
    }

    if (panel.type === 'row' && 'panels' in panel) {
      for (const nestedPanel of panel.panels) {
        const panelPluginToMigrateTo = getPanelPluginToMigrateTo(nestedPanel);
        if (panelPluginToMigrateTo) {
          nestedPanel.autoMigrateFrom = nestedPanel.type;
          nestedPanel.type = panelPluginToMigrateTo;
        }

        // if nested panel has an empty links array, just remove it
        // transformSceneToSaveModel sets empty links array to [] when no links are present
        if (nestedPanel.links?.length === 0) {
          delete nestedPanel.links;
        }

        // if nested panel has an empty options object, just remove it
        if (nestedPanel instanceof PanelModel && nestedPanel.options && Object.keys(nestedPanel.options).length === 0) {
          // @ts-expect-error - this type is required in PanelModel but it can be an empty object
          delete nestedPanel.options;
        }
      }
    }
  }

  // normalize annotations
  for (const annotation of frontendMigrationResult.annotations?.list ?? []) {
    for (const backendAnnotation of backendMigrationResult.annotations?.list ?? []) {
      if (annotation.datasource && backendAnnotation.datasource?.apiVersion) {
        annotation.datasource.apiVersion = backendAnnotation.datasource?.apiVersion;
      }

      if (annotation.datasource && backendAnnotation.datasource?.type) {
        annotation.datasource.type = backendAnnotation.datasource?.type;
      }
    }
  }
}
