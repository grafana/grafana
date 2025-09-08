import { readdirSync, readFileSync } from 'fs';
import path from 'path';

import { sortedDeepCloneWithoutNulls } from 'app/core/utils/object';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';
import { plugin as statPanelPlugin } from 'app/plugins/panel/stat/module';
import { plugin as tablePanelPlugin } from 'app/plugins/panel/table/module';

import { DashboardModel } from '../DashboardModel';

// Set up the same datasources as backend test provider to ensure consistency
export const dataSources = {
  default: mockDataSource({
    name: 'Default Test Datasource Name',
    uid: 'default-ds-uid',
    type: 'prometheus',
    isDefault: true,
    apiVersion: 'v1',
  }),
  nonDefault: mockDataSource({
    name: 'Non Default Test Datasource Name',
    uid: 'non-default-test-ds-uid',
    type: 'loki',
    isDefault: false,
    apiVersion: 'v1',
  }),
  existingRef: mockDataSource({
    name: 'Existing Ref Name',
    uid: 'existing-ref-uid',
    type: 'prometheus',
    isDefault: false,
    apiVersion: 'v1',
  }),
  existingTarget: mockDataSource({
    name: 'Existing Target Name',
    uid: 'existing-target-uid',
    type: 'elasticsearch',
    isDefault: false,
    apiVersion: 'v2',
  }),
  existingRefAlt: mockDataSource({
    name: 'Existing Ref Name',
    uid: 'existing-ref',
    type: 'prometheus',
    isDefault: false,
    apiVersion: 'v1',
  }),
  mixed: mockDataSource({
    name: MIXED_DATASOURCE_NAME,
    type: 'mixed',
    uid: MIXED_DATASOURCE_NAME,
    isDefault: false,
    apiVersion: 'v1',
  }),
};

export function setupTestDataSources() {
  setupDataSources(...Object.values(dataSources));
}

export function getTestDirectories() {
  const inputDir = path.join(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    '..',
    '..',
    'apps',
    'dashboard',
    'pkg',
    'migration',
    'testdata',
    'input'
  );

  return { inputDir };
}

export function getOutputDirectory(outputType: 'single_version' | 'latest_version') {
  return path.join(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    '..',
    '..',
    'apps',
    'dashboard',
    'pkg',
    'migration',
    'testdata',
    'output',
    outputType
  );
}

export function getJsonInputFiles(inputDir: string) {
  return readdirSync(inputDir).filter((inputFile) => inputFile.endsWith('.json'));
}

export function extractTargetVersionFromFilename(filename: string): number | null {
  const versionMatch = filename.match(/^v(\d+)\.(.+)\.json$/);
  if (!versionMatch) {
    return null;
  }
  return parseInt(versionMatch[1], 10);
}

export function constructBackendOutputFilename(inputFile: string, targetVersion: number): string {
  return inputFile.replace('.json', `.v${targetVersion}.json`);
}

export function constructLatestVersionOutputFilename(inputFile: string, latestVersion: number): string {
  return inputFile.replace('.json', `.v${latestVersion}.json`);
}

export const pluginVersionForAutoMigrate = '12.1.0';

export async function handleAngularPanelMigration(frontendModel: DashboardModel): Promise<void> {
  /* 
    Migration from schema V27 involves migrating angular singlestat panels to stat panels
    These panels are auto migrated where PanelModel.restoreModel() is called in the constructor,
    and the autoMigrateFrom is set and type is set to "stat". So this logic will not run.
    if (oldVersion < 28) {
      panelUpgrades.push((panel: PanelModel) => {
        if (panel.type === 'singlestat') {
          return migrateSinglestat(panel);
        }
      });
    }
  
    Furthermore, the PanelModel.pluginLoaded is run in the old architecture through a redux action so it will not run in this test.
    In the scenes architecture the angular migration logic runs through a migration handler inside transformSaveModelToScene.ts
     _UNSAFE_customMigrationHandler: getAngularPanelMigrationHandler(panel),
    We need to manually run the pluginLoaded logic to ensure the panels are migrated correctly. 
    which means that the actual migration logic is not run.
    We need to manually run the pluginLoaded logic to ensure the panels are migrated correctly.
  */
  for (const panel of frontendModel.panels) {
    if (panel.type === 'stat' && panel.autoMigrateFrom) {
      // Set the plugin version if it doesn't exist
      if (!statPanelPlugin.meta.info) {
        statPanelPlugin.meta.info = {
          author: {
            name: 'Grafana Labs',
            url: 'url/to/GrafanaLabs',
          },
          description: 'stat plugin',
          links: [{ name: 'project', url: 'one link' }],
          logos: { small: 'small/logo', large: 'large/logo' },
          screenshots: [],
          updated: '2024-01-01',
          version: pluginVersionForAutoMigrate,
        };
      }
      if (!statPanelPlugin.meta.info.version) {
        statPanelPlugin.meta.info.version = pluginVersionForAutoMigrate;
      }

      await panel.pluginLoaded(statPanelPlugin);
    }
    if (panel.type === 'table' && panel.autoMigrateFrom === 'table-old') {
      // Set the plugin version if it doesn't exist
      if (!tablePanelPlugin.meta.info) {
        tablePanelPlugin.meta.info = {
          author: {
            name: 'Grafana Labs',
            url: 'url/to/GrafanaLabs',
          },
          description: 'table plugin',
          links: [{ name: 'project', url: 'one link' }],
          logos: { small: 'small/logo', large: 'large/logo' },
          screenshots: [],
          updated: '2024-01-01',
          version: pluginVersionForAutoMigrate,
        };
      }
      if (!tablePanelPlugin.meta.info.version) {
        tablePanelPlugin.meta.info.version = pluginVersionForAutoMigrate;
      }

      await panel.pluginLoaded(tablePanelPlugin);
    }
  }
}

export function cleanDashboardModel(dashboard: DashboardModel) {
  // Although getSaveModelClone() runs sortedDeepCloneWithoutNulls() internally,
  // we run it again to ensure consistent handling of null values (like threshold -Infinity values)
  // Because Go and TS handle -Infinity differently.
  const dashboardWithoutNulls = sortedDeepCloneWithoutNulls(dashboard.getSaveModelClone());

  // Remove deprecated angular properties that backend shouldn't return, but DashboardModel will still set them
  for (const panel of dashboardWithoutNulls.panels ?? []) {
    // @ts-expect-error
    delete panel.autoMigrateFrom;
    // @ts-expect-error
    delete panel.styles;
    // @ts-expect-error - Backend removes these deprecated table properties
    delete panel.transform;
    // @ts-expect-error - Backend removes these deprecated table properties
    delete panel.columns;
  }

  return dashboardWithoutNulls;
}

export function shouldSkipAngularMigration(schemaVersion: number): boolean {
  return schemaVersion <= 27;
}

export const TEST_MIN_VERSION = 28;
