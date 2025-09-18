import { readFileSync } from 'fs';
import path from 'path';

import { variableAdapters } from 'app/features/variables/adapters';
import { createConstantVariableAdapter } from 'app/features/variables/constant/adapter';
import { createCustomVariableAdapter } from 'app/features/variables/custom/adapter';
import { createDataSourceVariableAdapter } from 'app/features/variables/datasource/adapter';
import { createIntervalVariableAdapter } from 'app/features/variables/interval/adapter';
import { createQueryVariableAdapter } from 'app/features/variables/query/adapter';
import { createTextBoxVariableAdapter } from 'app/features/variables/textbox/adapter';

import { DASHBOARD_SCHEMA_VERSION } from './DashboardMigrator';
import { DashboardModel } from './DashboardModel';
import {
  setupTestDataSources,
  getTestDirectories,
  getOutputDirectory,
  getJsonInputFiles,
  constructLatestVersionOutputFilename,
  handleAngularPanelMigration,
} from './__tests__/migrationTestUtils';

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
 *    - Since backendOutput.schemaVersion is already 42 (latest), no migration occurs
 *    - This ensures we compare the final migrated state from both paths
 *
 * 4. Benefits of this approach:
 *    - Tests the complete integration (backend migration + DashboardModel)
 *    - Accounts for DashboardModel's default value handling and normalization
 *    - Ensures both paths produce identical final dashboard states
 *    - Avoids test brittleness from comparing raw JSON with different default value representations
 */

variableAdapters.register(createQueryVariableAdapter());
variableAdapters.register(createDataSourceVariableAdapter());
variableAdapters.register(createConstantVariableAdapter());
variableAdapters.register(createIntervalVariableAdapter());
variableAdapters.register(createCustomVariableAdapter());
variableAdapters.register(createTextBoxVariableAdapter());

describe('Backend / Frontend result comparison', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupTestDataSources();
  });

  const { inputDir } = getTestDirectories();
  const outputDir = getOutputDirectory('latest_version');
  const jsonInputs = getJsonInputFiles(inputDir);

  jsonInputs.forEach((inputFile) => {
    it(`should migrate ${inputFile} correctly`, async () => {
      const jsonInput = JSON.parse(readFileSync(path.join(inputDir, inputFile), 'utf8'));

      // Construct the backend output filename: v30.something.json -> v30.something.v41.json
      const backendOutputFilename = constructLatestVersionOutputFilename(inputFile, DASHBOARD_SCHEMA_VERSION);
      const backendMigrationResult = JSON.parse(readFileSync(path.join(outputDir, backendOutputFilename), 'utf8'));

      expect(backendMigrationResult.schemaVersion).toEqual(DASHBOARD_SCHEMA_VERSION);

      // Migrate dashboard in Frontend.
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
