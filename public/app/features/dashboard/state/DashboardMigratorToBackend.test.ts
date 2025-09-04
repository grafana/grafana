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

const MIN_SUPPORTED_SCHEMA_VERSION = 13;

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
  describe('Manual mocks', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      setupDataSources(...Object.values(dataSources));
    });

    const inputDir = getMigrationTestDataPath('input');
    const outputDir = getMigrationTestDataPath('output');

    const jsonInputs = readdirSync(inputDir);

    jsonInputs.forEach((inputFile) => {
      it(`should migrate ${inputFile} correctly`, async () => {
        const jsonInput = JSON.parse(readFileSync(path.join(inputDir, inputFile), 'utf8'));
        const backendOutput = JSON.parse(readFileSync(path.join(outputDir, inputFile), 'utf8'));

        await performMigrationComparison(jsonInput, backendOutput);
      });
    });
  });

  describe('Dev-dashboards', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      setupDataSources(...Object.values(devDashboardDataSources));
    });

    const devDashboardsInputDir = path.join(__dirname, '..', '..', '..', '..', '..', 'devenv', 'dev-dashboards');
    const devDashboardsOutputDir = getMigrationTestDataPath('dev-dashboards-output');

    const allDevDashboardFiles = findJSONFiles(devDashboardsInputDir);

    // Filter out files that can't be parsed as JSON or don't have valid schemaVersion
    const validDevDashboardFiles = allDevDashboardFiles.filter((filePath) => {
      const isValid = isValidDashboardForMigration(filePath);
      if (!isValid) {
        console.error(`Dashboard ${filePath} is not valid for migration testing`);
      }
      return isValid;
    });

    validDevDashboardFiles.forEach((inputFilePath) => {
      const relativePath = path.relative(devDashboardsInputDir, inputFilePath);
      const testName = `should migrate dev-dashboard ${relativePath} correctly`;

      it(testName, async () => {
        const jsonInput = JSON.parse(readFileSync(inputFilePath, 'utf8'));
        const outputFilePath = getRelativeOutputPath(inputFilePath, devDashboardsInputDir, devDashboardsOutputDir);

        // Backend output should exist since we now fail on unsupported dashboards
        const backendOutput = JSON.parse(readFileSync(outputFilePath, 'utf8'));
        await performMigrationComparison(jsonInput, backendOutput);
      });
    });
  });

  describe('Historical dashboards', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      setupDataSources(...Object.values(dataSources));
    });

    const historicalDashboardsInputDir = getMigrationTestDataPath('historical-dashboards-input');
    const historicalDashboardsOutputDir = getMigrationTestDataPath('historical-dashboards-output');

    // Find all historical dashboard files and create individual test cases
    const allHistoricalFiles = readdirSync(historicalDashboardsInputDir).sort();

    // Filter out files that can't be parsed as JSON or don't have valid schemaVersion
    const validHistoricalFiles = allHistoricalFiles.filter((fileName) => {
      const filePath = path.join(historicalDashboardsInputDir, fileName);
      return isValidDashboardForMigration(filePath);
    });

    validHistoricalFiles.forEach((fileName) => {
      const testName = `should migrate historical dashboard ${fileName} correctly`;

      it(testName, async () => {
        const inputFilePath = path.join(historicalDashboardsInputDir, fileName);
        const outputFilePath = path.join(historicalDashboardsOutputDir, fileName);

        const jsonInput = JSON.parse(readFileSync(inputFilePath, 'utf8'));

        // Backend output should exist since we now fail on unsupported dashboards
        const backendOutput = JSON.parse(readFileSync(outputFilePath, 'utf8'));
        await performMigrationComparison(jsonInput, backendOutput);
      });
    });
  });

  describe('Community dashboards', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      setupDataSources(...Object.values(dataSources));
    });

    createCommunityDashboardTests();
  });

  describe('Oldest community dashboards', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      setupDataSources(...Object.values(dataSources));
    });

    createOldestHistoricalDashboardTests();
  });
});

function createCommunityDashboardTests() {
  const communityDashboardsBaseInputDir = getMigrationTestDataPath('community-dashboards-input');
  const communityDashboardsBaseOutputDir = getMigrationTestDataPath('community-dashboards-output');

  // Scan all category subdirectories (oldest, newest, average)
  const categories = ['oldest', 'newest', 'average'];
  const allValidFiles: Array<{ fileName: string; category: string; inputPath: string; outputPath: string }> = [];

  categories.forEach((category) => {
    const inputDir = path.join(communityDashboardsBaseInputDir, category);
    const outputDir = path.join(communityDashboardsBaseOutputDir, category);

    try {
      const dirContents = readdirSync(inputDir);
      if (!dirContents.length) {
        return; // Skip empty directories
      }
    } catch (error) {
      return; // Skip if directory doesn't exist
    }

    // Find all community dashboard files in this category
    const allCommunityFiles = readdirSync(inputDir).sort();

    // Filter out files that can't be parsed as JSON or don't have valid schemaVersion
    const validCommunityFiles = allCommunityFiles.filter((fileName) => {
      const filePath = path.join(inputDir, fileName);
      return isValidDashboardForMigration(filePath);
    });

    // Add valid files from this category to the combined list
    validCommunityFiles.forEach((fileName) => {
      allValidFiles.push({
        fileName,
        category,
        inputPath: path.join(inputDir, fileName),
        outputPath: path.join(outputDir, fileName),
      });
    });
  });

  // Create test cases for all valid community dashboards across all categories
  allValidFiles.forEach(({ fileName, category, inputPath, outputPath }) => {
    const testName = `should migrate community dashboard ${fileName} correctly`;

    it(testName, async () => {
      const jsonInput = JSON.parse(readFileSync(inputPath, 'utf8'));

      // Backend output should exist since we now fail on unsupported dashboards
      const backendOutput = JSON.parse(readFileSync(outputPath, 'utf8'));
      await performMigrationComparison(jsonInput, backendOutput);
    });
  });
}

function createOldestHistoricalDashboardTests() {
  const oldestHistoricalInputDir = getMigrationTestDataPath('oldest-historical-input');
  const oldestHistoricalOutputDir = getMigrationTestDataPath('oldest-historical-output');

  // Find all oldest-historical dashboard files and create individual test cases
  const allOldestHistoricalFiles = readdirSync(oldestHistoricalInputDir).sort();

  // Filter out files that can't be parsed as JSON or don't have valid schemaVersion
  const validOldestHistoricalFiles = allOldestHistoricalFiles.filter((fileName) => {
    const filePath = path.join(oldestHistoricalInputDir, fileName);
    return isValidDashboardForMigration(filePath);
  });

  validOldestHistoricalFiles.forEach((fileName) => {
    const testName = `should migrate oldest community dashboard ${fileName} correctly`;

    it(testName, async () => {
      const inputFilePath = path.join(oldestHistoricalInputDir, fileName);
      const outputFilePath = path.join(oldestHistoricalOutputDir, fileName);

      const jsonInput = JSON.parse(readFileSync(inputFilePath, 'utf8'));

      // Backend output should exist since we now fail on unsupported dashboards
      const backendOutput = JSON.parse(readFileSync(outputFilePath, 'utf8'));
      await performMigrationComparison(jsonInput, backendOutput);
    });
  });
}

// Helper function to ensure plugin meta is properly initialized
function ensurePluginMeta(plugin: Record<string, unknown>, pluginName: string) {
  if (!plugin.meta) {
    plugin.meta = {} as Record<string, unknown>;
  }

  if (!plugin.meta.info) {
    plugin.meta.info = {
      author: {
        name: 'Grafana Labs',
        url: 'url/to/GrafanaLabs',
      },
      description: `${pluginName} plugin`,
      links: [{ name: 'project', url: 'one link' }],
      logos: { small: 'small/logo', large: 'large/logo' },
      screenshots: [],
      updated: '2024-01-01',
      version: '1.0.0',
    };
  }

  if (!plugin.meta.info.version) {
    plugin.meta.info.version = '1.0.0';
  }
}

// Helper function to handle angular panel migration for old schema versions
async function handleAngularPanelMigration(dashboardModel: DashboardModel, schemaVersion: number) {
  if (schemaVersion <= 27) {
    for (const panel of dashboardModel.panels) {
      if (panel.type === 'stat' && panel.autoMigrateFrom) {
        ensurePluginMeta(statPanelPlugin, 'stat');
        await panel.pluginLoaded(statPanelPlugin);
      }
      if (panel.type === 'table' && panel.autoMigrateFrom === 'table-old') {
        ensurePluginMeta(tablePanelPlugin, 'table');
        await panel.pluginLoaded(tablePanelPlugin as Record<string, unknown>);
      }
    }
  }
}

// Helper function to clean up frontend migration result to match backend behavior
function cleanupFrontendResult(frontendMigrationResult: Record<string, unknown>) {
  const cleanedResult = sortedDeepCloneWithoutNulls(frontendMigrationResult);

  // Remove deprecated angular properties that backend shouldn't return, but DashboardModel will still set them
  for (const panel of cleanedResult.panels ?? []) {
    // Remove deprecated angular properties that may exist on panels
    delete (panel as Record<string, unknown>).autoMigrateFrom;
    delete (panel as Record<string, unknown>).styles;
    delete (panel as Record<string, unknown>).transform; // Backend removes these deprecated table properties
    delete (panel as Record<string, unknown>).columns; // Backend removes these deprecated table properties
  }

  return cleanedResult;
}

// Unified helper function to perform migration comparison tests
async function performMigrationComparison(jsonInput: Record<string, unknown>, backendOutput: Record<string, unknown>) {
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

// Helper function to validate if a dashboard has valid schema version for migration testing
function isValidDashboardForMigration(filePath: string): boolean {
  try {
    const jsonContent = JSON.parse(readFileSync(filePath, 'utf8'));
    // Require valid schemaVersion for migration testing
    if (typeof jsonContent.schemaVersion !== 'number') {
      return false;
    }
    // Check minimum version requirement (this should match backend MIN_VERSION = 13)

    if (jsonContent.schemaVersion < MIN_SUPPORTED_SCHEMA_VERSION) {
      return false;
    }
    return true;
  } catch (error) {
    return false; // Skip files that can't be parsed
  }
}

// Helper function to create a path to the migration testdata directory
function getMigrationTestDataPath(...pathSegments: string[]): string {
  return path.join(
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
    ...pathSegments
  );
}
