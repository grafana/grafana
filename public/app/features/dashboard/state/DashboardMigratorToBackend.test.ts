import { readdirSync, readFileSync, statSync } from 'fs';
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
 * Backend / Frontend Migration Comparison Test Design Explanation:
 *
 * This test compares backend and frontend migration results by running both through DashboardModel.
 * This approach is correct and not flaky for the following reasons:
 *
 * 1. Frontend Migration Path:
 *    jsonInput (e.g. v39) → DashboardModel → DashboardMigrator runs → migrates to v41 → getSaveModelClone()
 *
 * 2. Backend Migration Path:
 *    jsonInput (e.g. v39) → Backend Migration → backendOutput (v41) → DashboardModel → DashboardMigrator sees v41 → early return (no migration) → getSaveModelClone()
 *
 * 3. Why DashboardMigrator doesn't run on backendOutput:
 *    - DashboardMigrator.updateSchema() has an early return: `if (oldVersion === this.dashboard.schemaVersion) return;`
 *    - Since backendOutput.schemaVersion is already 41 (latest), no migration occurs
 *    - This ensures we compare the final migrated state from both paths
 *
 * 4. Benefits of this approach:
 *    - Tests the complete integration (backend migration + DashboardModel)
 *    - Accounts for DashboardModel's default value handling and normalization
 *    - Ensures both paths produce identical final dashboard states
 *    - Avoids test brittleness from comparing raw JSON with different default value representations
 */

// Helper function to recursively find all JSON files in a directory
function findJSONFiles(dir: string): string[] {
  const jsonFiles: string[] = [];

  function walk(currentDir: string) {
    const entries = readdirSync(currentDir);
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (entry.toLowerCase().endsWith('.json')) {
        jsonFiles.push(fullPath);
      }
    }
  }

  walk(dir);
  return jsonFiles;
}

// Helper function to convert input path to relative output path preserving directory structure
function getRelativeOutputPath(inputPath: string, inputDir: string, outputDir: string): string {
  const relativePath = path.relative(inputDir, inputPath);
  // Preserve directory structure instead of flattening
  return path.join(outputDir, relativePath);
}

// Set up the same datasources as backend test provider to ensure consistency
const dataSources = {
  default: mockDataSource({
    name: 'Default Test Datasource Name',
    uid: 'default-ds-uid',
    type: 'prometheus',
    isDefault: true,
  }),
  nonDefault: mockDataSource({
    name: 'Non Default Test Datasource Name',
    uid: 'non-default-test-ds-uid',
    type: 'loki',
    isDefault: false,
  }),
  existingRef: mockDataSource({
    name: 'Existing Ref Name',
    uid: 'existing-ref-uid',
    type: 'prometheus',
    isDefault: false,
  }),
  existingTarget: mockDataSource({
    name: 'Existing Target Name',
    uid: 'existing-target-uid',
    type: 'elasticsearch',
    isDefault: false,
  }),
  existingRefAlt: mockDataSource({
    name: 'Existing Ref Name',
    uid: 'existing-ref',
    type: 'prometheus',
    isDefault: false,
  }),
  mixed: mockDataSource({
    name: MIXED_DATASOURCE_NAME,
    type: 'mixed',
    uid: MIXED_DATASOURCE_NAME,
    isDefault: false,
  }),
};

// Separate datasource setup for dev-dashboards which primarily use testdata datasource
const devDashboardDataSources = {
  // Add datasource that can be found by type name for migration resolution
  testdataByType: mockDataSource(
    {
      name: 'grafana-testdata-datasource',
      uid: 'testdata-type-uid',
      type: 'grafana-testdata-datasource',
      isDefault: true,
    },
    {
      metrics: true,
      annotations: true,
      logs: true,
    }
  ),
  testdata: mockDataSource(
    {
      name: 'TestData',
      uid: 'testdata',
      type: 'grafana-testdata-datasource',
      isDefault: false,
    },
    {
      metrics: true,
      annotations: true,
      logs: true,
    }
  ),
  prometheus: mockDataSource({
    name: 'Prometheus',
    uid: 'prometheus-uid',
    type: 'prometheus',
    isDefault: false,
  }),
  loki: mockDataSource({
    name: 'Loki',
    uid: 'loki-uid',
    type: 'loki',
    isDefault: false,
  }),
  elasticsearch: mockDataSource({
    name: 'Elasticsearch',
    uid: 'elasticsearch-uid',
    type: 'elasticsearch',
    isDefault: false,
  }),
  mixed: mockDataSource({
    name: MIXED_DATASOURCE_NAME,
    type: 'mixed',
    uid: MIXED_DATASOURCE_NAME,
    isDefault: false,
  }),
};

describe('Backend / Frontend result comparison', () => {
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
    'output'
  );

  const jsonInputs = readdirSync(inputDir);

  jsonInputs.forEach((inputFile) => {
    it(`should migrate ${inputFile} correctly`, async () => {
      const jsonInput = JSON.parse(readFileSync(path.join(inputDir, inputFile), 'utf8'));
      const backendOutput = JSON.parse(readFileSync(path.join(outputDir, inputFile), 'utf8'));

      expect(backendOutput.schemaVersion).toEqual(DASHBOARD_SCHEMA_VERSION);

      // Create dashboard models
      const frontendModel = new DashboardModel(jsonInput);
      const backendModel = new DashboardModel(backendOutput);

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

      const frontendMigrationResult = frontendModel.getSaveModelClone();
      const backendMigrationResult = backendModel.getSaveModelClone();

      // Although getSaveModelClone() runs sortedDeepCloneWithoutNulls() internally,
      // we run it again to ensure consistent handling of null values (like threshold -Infinity values)
      // Because Go and TS handle -Infinity differently.
      const cleanedFrontendResult = sortedDeepCloneWithoutNulls(frontendMigrationResult);

      // Remove deprecated angular properties that backend shouldn't return, but DashboardModel will still set them
      for (const panel of cleanedFrontendResult.panels ?? []) {
        // Remove deprecated angular properties that may exist on panels
        delete (panel as any).autoMigrateFrom;
        delete (panel as any).styles;
        delete (panel as any).transform; // Backend removes these deprecated table properties
        delete (panel as any).columns; // Backend removes these deprecated table properties
      }

      expect(backendMigrationResult).toMatchObject(cleanedFrontendResult);
    });
  });
});

describe('Dev-dashboards Backend / Frontend result comparison', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDataSources(...Object.values(devDashboardDataSources));
  });

  const devDashboardsInputDir = path.join(__dirname, '..', '..', '..', '..', '..', 'devenv', 'dev-dashboards');
  const devDashboardsOutputDir = path.join(
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
    'dev-dashboards-output'
  );

  const allDevDashboardFiles = findJSONFiles(devDashboardsInputDir);

  // Filter out files that can't be parsed as JSON or don't have valid schemaVersion
  const validDevDashboardFiles = allDevDashboardFiles.filter((filePath) => {
    try {
      const jsonContent = JSON.parse(readFileSync(filePath, 'utf8'));
      // Require valid schemaVersion for migration testing
      if (typeof jsonContent.schemaVersion !== 'number') {
        console.error(`Dashboard ${filePath} has no schemaVersion - not valid for migration testing`);
        return false;
      }
      // Check minimum version requirement (this should match backend MIN_VERSION = 13)
      const MIN_SUPPORTED_SCHEMA_VERSION = 13;
      if (jsonContent.schemaVersion < MIN_SUPPORTED_SCHEMA_VERSION) {
        console.error(
          `Dashboard ${filePath} has schema version ${jsonContent.schemaVersion} which is below minimum supported version ${MIN_SUPPORTED_SCHEMA_VERSION}`
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error(`Failed to parse JSON for ${filePath}:`, error);
      return false; // Skip files that can't be parsed
    }
  });

  validDevDashboardFiles.forEach((inputFilePath) => {
    const relativePath = path.relative(devDashboardsInputDir, inputFilePath);
    const testName = `should migrate dev-dashboard ${relativePath} correctly`;

    it(testName, async () => {
      const jsonInput = JSON.parse(readFileSync(inputFilePath, 'utf8'));
      const outputFilePath = getRelativeOutputPath(inputFilePath, devDashboardsInputDir, devDashboardsOutputDir);

      // Backend output should exist since we now fail on unsupported dashboards
      const backendOutput = JSON.parse(readFileSync(outputFilePath, 'utf8'));
      await performDevDashboardMigrationComparison(jsonInput, backendOutput);
    });
  });
});

// Helper function to handle angular panel migration for old schema versions
async function handleAngularPanelMigration(dashboardModel: DashboardModel, schemaVersion: number) {
  if (schemaVersion <= 27) {
    for (const panel of dashboardModel.panels) {
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
}

// Helper function to clean up frontend migration result to match backend behavior
function cleanupFrontendResult(frontendMigrationResult: any) {
  const cleanedResult = sortedDeepCloneWithoutNulls(frontendMigrationResult);

  // Remove deprecated angular properties that backend shouldn't return, but DashboardModel will still set them
  for (const panel of cleanedResult.panels ?? []) {
    // Remove deprecated angular properties that may exist on panels
    delete (panel as any).autoMigrateFrom;
    delete (panel as any).styles;
    delete (panel as any).transform; // Backend removes these deprecated table properties
    delete (panel as any).columns; // Backend removes these deprecated table properties
  }

  return cleanedResult;
}

// Helper function to perform the dev-dashboards migration comparison test
async function performDevDashboardMigrationComparison(jsonInput: any, backendOutput: any) {
  expect(backendOutput.schemaVersion).toEqual(DASHBOARD_SCHEMA_VERSION);

  // Create dashboard models
  const frontendModel = new DashboardModel(jsonInput);
  const backendModel = new DashboardModel(backendOutput);

  // Handle angular panel migration for old schema versions (only if schemaVersion exists)
  if (typeof jsonInput.schemaVersion === 'number') {
    await handleAngularPanelMigration(frontendModel, jsonInput.schemaVersion);
  }

  const frontendMigrationResult = frontendModel.getSaveModelClone();
  const backendMigrationResult = backendModel.getSaveModelClone();

  // Clean up the frontend result to match backend behavior
  const cleanedFrontendResult = cleanupFrontendResult(frontendMigrationResult);

  expect(backendMigrationResult).toMatchObject(cleanedFrontendResult);
}
