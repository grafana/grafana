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
  extractTargetVersionFromFilename,
  constructBackendOutputFilename,
} from './__tests__/migrationTestUtils';
import { getPanelPluginToMigrateTo } from './getPanelPluginToMigrateTo';

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

variableAdapters.register(createQueryVariableAdapter());
variableAdapters.register(createDataSourceVariableAdapter());
variableAdapters.register(createConstantVariableAdapter());
variableAdapters.register(createIntervalVariableAdapter());
variableAdapters.register(createCustomVariableAdapter());
variableAdapters.register(createTextBoxVariableAdapter());

describe('Backend / Frontend single version migration result comparison', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupTestDataSources();
  });

  // Dashboards to skip in single version migration tests due to known inconsistencies
  const SINGLE_VERSION_TEST_BLACKLIST = [
    'mimir_rollout_debugging', // Backend correctly preserves rows structure for v15, frontend processes through DashboardModel
  ];

  const { inputDir } = getTestDirectories();
  const outputDir = getOutputDirectory('single_version');
  const jsonInputs = getJsonInputFiles(inputDir);

  jsonInputs.forEach((inputFile) => {
    // Extract target version from filename (e.g., v16.grid_layout_upgrade.json -> target v16)
    const targetVersion = extractTargetVersionFromFilename(inputFile);
    if (!targetVersion) {
      return; // Skip files that don't match the expected pattern
    }

    // Skip if target version exceeds latest version
    if (targetVersion > DASHBOARD_SCHEMA_VERSION) {
      return;
    }

    // Skip blacklisted dashboards
    if (SINGLE_VERSION_TEST_BLACKLIST.some((blacklisted) => inputFile.includes(blacklisted))) {
      return;
    }

    it(`should migrate ${inputFile} to v${targetVersion} correctly`, async () => {
      const jsonInput = JSON.parse(readFileSync(path.join(inputDir, inputFile), 'utf8'));

      // Verify the input file follows the naming convention: filename version = target version, schemaVersion = target - 1
      const expectedSchemaVersion = targetVersion - 1;
      expect(jsonInput.schemaVersion).toBe(expectedSchemaVersion);

      // Construct the backend output filename: v15.something.json -> v15.something.v16.json
      const backendOutputFilename = constructBackendOutputFilename(inputFile, targetVersion);
      const backendOutputPath = path.join(outputDir, backendOutputFilename);

      // Check if the backend output file exists
      const backendMigrationResult = JSON.parse(readFileSync(backendOutputPath, 'utf8'));

      expect(backendMigrationResult.schemaVersion).toEqual(targetVersion);

      // Migrate dashboard in Frontend.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let migratedTemplatingList: any[] = jsonInput?.templating?.list ?? [];
      const frontendModel = new DashboardModel(jsonInput, undefined, {
        targetSchemaVersion: targetVersion,
        getVariablesFromState: () => migratedTemplatingList,
      });
      // Update the templating list reference after migration
      migratedTemplatingList = frontendModel.templating?.list ?? [];

      const frontendMigrationResult = frontendModel.getSaveModelClone();

      // version in the backend is never added because it is returned from the backend as metadata
      delete frontendMigrationResult.version;

      // since we are initializing panels inside collapsed rows with PanelModel in transformSceneToSaveModel (see createRowItemFromLegacyRow)
      // and not in DashboardModel, this means that these panels will have automigratedFrom and panel type changed to the new panel type
      // backend matches this behaviour by setting up autoMigrateFrom and type for nested panels too
      // @ts-expect-error - we are using the type from the frontend migration result
      for (const panel of frontendMigrationResult.panels) {
        if (panel.type === 'row' && 'panels' in panel) {
          for (const nestedPanel of panel.panels) {
            const panelPluginToMigrateTo = getPanelPluginToMigrateTo(nestedPanel);
            if (panelPluginToMigrateTo) {
              // @ts-expect-error - we are using the type from the frontend migration result
              nestedPanel.autoMigrateFrom = nestedPanel.type;
              nestedPanel.type = panelPluginToMigrateTo;
            }
          }
        }
      }

      expect(backendMigrationResult).toEqual(frontendMigrationResult);
    });
  });
});
