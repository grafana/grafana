import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

import { variableAdapters } from 'app/features/variables/adapters';
import { createAdHocVariableAdapter } from 'app/features/variables/adhoc/adapter';
import { createConstantVariableAdapter } from 'app/features/variables/constant/adapter';
import { createCustomVariableAdapter } from 'app/features/variables/custom/adapter';
import { createDataSourceVariableAdapter } from 'app/features/variables/datasource/adapter';
import { createIntervalVariableAdapter } from 'app/features/variables/interval/adapter';
import { createQueryVariableAdapter } from 'app/features/variables/query/adapter';
import { createTextBoxVariableAdapter } from 'app/features/variables/textbox/adapter';

import { DASHBOARD_SCHEMA_VERSION } from './DashboardMigrator';
import { DashboardModel } from './DashboardModel';
import {
  setupDevDashboardDataSources,
  handleAngularPanelMigration,
  constructLatestVersionOutputFilename,
} from './__tests__/migrationTestUtils';

/*
 * Dev Dashboard Backend / Frontend Migration Comparison Test
 *
 * This test compares backend and frontend migration results for all dev dashboards
 * to ensure consistency between the two migration paths.
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

variableAdapters.register(createQueryVariableAdapter());
variableAdapters.register(createDataSourceVariableAdapter());
variableAdapters.register(createConstantVariableAdapter());
variableAdapters.register(createIntervalVariableAdapter());
variableAdapters.register(createCustomVariableAdapter());
variableAdapters.register(createTextBoxVariableAdapter());
variableAdapters.register(createAdHocVariableAdapter());

describe('Dev Dashboard Backend / Frontend result comparison', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup dev dashboard datasources to match backend DevDashboardDataSourceProvider
    setupDevDashboardDataSources();
  });

  const devDashboardInputDir = '../../../../../devenv/dev-dashboards';
  const devDashboardOutputDir = '../../../../../apps/dashboard/pkg/migration/testdata/dev-dashboards-output';

  // Find all JSON files in dev-dashboards directory
  const devDashboardFiles = findJSONFiles(path.join(__dirname, devDashboardInputDir));

  devDashboardFiles.forEach((inputFile) => {
    const relativeInputPath = path.relative(path.join(__dirname, devDashboardInputDir), inputFile);

    it(`should migrate dev dashboard ${relativeInputPath} correctly`, async () => {
      const jsonInput = JSON.parse(readFileSync(inputFile, 'utf8'));

      // Skip dashboards that don't have a valid schema version
      if (!jsonInput.schemaVersion || jsonInput.schemaVersion < 13) {
        return; // Skip test for invalid dashboards
      }

      // Construct the backend output path preserving directory structure
      const backendOutputPath = getRelativeOutputPath(
        inputFile,
        path.join(__dirname, devDashboardInputDir),
        path.join(__dirname, devDashboardOutputDir)
      );

      // Construct the backend output filename: dashboard.json -> dashboard.v42.json
      const backendOutputFilename = constructLatestVersionOutputFilename(
        path.basename(backendOutputPath),
        DASHBOARD_SCHEMA_VERSION
      );
      const backendOutputWithSuffix = path.join(path.dirname(backendOutputPath), backendOutputFilename);
      const backendMigrationResult = JSON.parse(readFileSync(backendOutputWithSuffix, 'utf8'));

      expect(backendMigrationResult.schemaVersion).toEqual(DASHBOARD_SCHEMA_VERSION);

      // Migrate dashboard in Frontend using dev dashboard datasources
      const frontendModel = new DashboardModel(jsonInput, undefined, {
        getVariablesFromState: () => jsonInput?.templating?.list ?? [],
      });

      // Handle angular panel migration if needed
      await handleAngularPanelMigration(frontendModel, jsonInput.schemaVersion, DASHBOARD_SCHEMA_VERSION);

      const frontendMigrationResult = frontendModel.getSaveModelClone();

      expect(backendMigrationResult).toEqual(frontendMigrationResult);
    });
  });
});
