import { readFileSync } from 'fs';
import path from 'path';

import { DASHBOARD_SCHEMA_VERSION } from './DashboardMigrator';
import { DashboardModel } from './DashboardModel';
import {
  setupTestDataSources,
  getTestDirectories,
  getOutputDirectory,
  getJsonInputFiles,
  constructLatestVersionOutputFilename,
  handleAngularPanelMigration,
  cleanDashboardModel,
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
 *    - Since backendOutput.schemaVersion is already 41 (latest), no migration occurs
 *    - This ensures we compare the final migrated state from both paths
 *
 * 4. Benefits of this approach:
 *    - Tests the complete integration (backend migration + DashboardModel)
 *    - Accounts for DashboardModel's default value handling and normalization
 *    - Ensures both paths produce identical final dashboard states
 *    - Avoids test brittleness from comparing raw JSON with different default value representations
 */

describe('Backend / Frontend result comparison', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupTestDataSources();
  });

  const { inputDir } = getTestDirectories();
  const outputDir = getOutputDirectory('latest_version');
  const jsonInputs = getJsonInputFiles(inputDir);

  jsonInputs
    // TODO: remove this filter when we fixed all inconsistencies
    .filter((inputFile) => parseInt(inputFile.split('.')[0].replace('v', ''), 10) > 29)
    .forEach((inputFile) => {
      it(`should migrate ${inputFile} correctly`, async () => {
        const jsonInput = JSON.parse(readFileSync(path.join(inputDir, inputFile), 'utf8'));

        // Construct the backend output filename: v30.something.json -> v30.something.v41.json
        const backendOutputFilename = constructLatestVersionOutputFilename(inputFile, DASHBOARD_SCHEMA_VERSION);
        const backendOutput = JSON.parse(readFileSync(path.join(outputDir, backendOutputFilename), 'utf8'));

        expect(backendOutput.schemaVersion).toEqual(DASHBOARD_SCHEMA_VERSION);

        // Create dashboard models
        const frontendModel = new DashboardModel(jsonInput, undefined, {
          targetSchemaVersion: DASHBOARD_SCHEMA_VERSION,
        });
        const backendModel = new DashboardModel(backendOutput);

        // Handle angular panel migration if needed
        if (jsonInput.schemaVersion <= 27) {
          await handleAngularPanelMigration(frontendModel);
        }

        const frontendMigrationResult = cleanDashboardModel(frontendModel);
        const backendMigrationResult = cleanDashboardModel(backendModel);

        expect(backendMigrationResult).toEqual(frontendMigrationResult);
      });
    });
});
