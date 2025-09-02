import { readdirSync, readFileSync } from 'fs';
import path from 'path';

import { sortedDeepCloneWithoutNulls } from 'app/core/utils/object';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';
import { plugin as statPanelPlugin } from 'app/plugins/panel/stat/module';
import { plugin as tablePanelPlugin } from 'app/plugins/panel/table/module';

import { DASHBOARD_SCHEMA_VERSION } from './DashboardMigrator';
import { DashboardModel } from './DashboardModel';

/*
 * Single Version Migration Test Design Explanation:
 *
 * This test compares backend and frontend single version migration results by running both through DashboardModel.
 * Instead of migrating to the latest version like DashboardMigratorToBackend.test.ts, this test migrates to the
 * specific target version indicated in the filename (e.g., v16.grid_layout_upgrade.json migrates to v16).
 *
 * This approach is correct and not flaky for the following reasons:
 *
 * 1. Frontend Single Version Migration Path:
 *    jsonInput (e.g. v15) → DashboardModel with targetVersion=16 → DashboardMigrator runs → migrates to v16 → getSaveModelClone()
 *
 * 2. Backend Single Version Migration Path:
 *    jsonInput (e.g. v15) → Backend Migration to v16 → backendOutput (v16) → DashboardModel → DashboardMigrator sees v16 → early return (no migration) → getSaveModelClone()
 *
 * 3. Why DashboardMigrator doesn't run on backendOutput:
 *    - DashboardMigrator.updateSchema() has an early return: `if (oldVersion === this.dashboard.schemaVersion) return;`
 *    - Since backendOutput.schemaVersion is already at the target version, no migration occurs
 *    - This ensures we compare the final migrated state from both paths
 *
 * 4. Benefits of this approach:
 *    - Tests the complete integration (backend single version migration + DashboardModel)
 *    - Accounts for DashboardModel's default value handling and normalization
 *    - Ensures both paths produce identical final dashboard states for single version migrations
 *    - Avoids test brittleness from comparing raw JSON with different default value representations
 */

// Set up the same datasources as backend test provider to ensure consistency
const dataSources = {
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

describe('Backend / Frontend single version migration result comparison', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDataSources(...Object.values(dataSources));
  });

  const inputDir = path.join(
    __dirname,
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
  const outputDir = path.join(
    __dirname,
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
    'single_version'
  );

  const jsonInputs = readdirSync(inputDir);

  jsonInputs
    // TODO: remove this filter when we fixed all inconsistencies
    .filter((inputFile) => parseInt(inputFile.split('.')[0].replace('v', ''), 10) > 29)
    .filter((inputFile) => inputFile.endsWith('.json'))
    .forEach((inputFile) => {
      // Extract target version from filename (e.g., v16.grid_layout_upgrade.json -> target v16)
      const versionMatch = inputFile.match(/^v(\d+)\.(.+)\.json$/);
      if (!versionMatch) {
        return; // Skip files that don't match the expected pattern
      }

      const targetVersion = parseInt(versionMatch[1], 10);

      // Skip if target version exceeds latest version
      if (targetVersion > DASHBOARD_SCHEMA_VERSION) {
        return;
      }

      it(`should migrate ${inputFile} to v${targetVersion} correctly`, async () => {
        const jsonInput = JSON.parse(readFileSync(path.join(inputDir, inputFile), 'utf8'));

        // Verify the input file follows the naming convention: filename version = target version, schemaVersion = target - 1
        const expectedSchemaVersion = targetVersion - 1;
        expect(jsonInput.schemaVersion).toBe(expectedSchemaVersion);

        // Generate the expected output filename for single version migration
        const singleVersionOutputFile = `${inputFile.replace('.json', '')}.v${targetVersion}.json`;
        const singleVersionOutputPath = path.join(outputDir, singleVersionOutputFile);

        // Check if the single version output file exists
        let backendOutput: any;
        try {
          backendOutput = JSON.parse(readFileSync(singleVersionOutputPath, 'utf8'));
        } catch (error) {
          // If single version output doesn't exist, skip this test
          // This can happen if the backend test hasn't generated the single version output yet
          console.warn(`Skipping ${inputFile}: single version output file ${singleVersionOutputFile} not found`);
          return;
        }

        expect(backendOutput.schemaVersion).toEqual(targetVersion);

        // Create dashboard models
        const frontendModel = new DashboardModel(jsonInput, undefined, {
          targetSchemaVersion: targetVersion,
        });
        const backendModel = new DashboardModel(backendOutput, undefined, {
          targetSchemaVersion: targetVersion,
        });

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
        if (jsonInput.schemaVersion <= 27) {
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
                  version: '1.0.0',
                };
              }
              if (!statPanelPlugin.meta.info.version) {
                statPanelPlugin.meta.info.version = '1.0.0';
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
                  version: '1.0.0',
                };
              }
              if (!tablePanelPlugin.meta.info.version) {
                tablePanelPlugin.meta.info.version = '1.0.0';
              }

              await panel.pluginLoaded(tablePanelPlugin as any);
            }
          }
        }

        const frontendMigrationResult = cleanDashboardModel(frontendModel);
        const backendMigrationResult = cleanDashboardModel(backendModel);

        expect(backendMigrationResult).toEqual(frontendMigrationResult);
      });
    });
});

function cleanDashboardModel(dashboard: DashboardModel) {
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
