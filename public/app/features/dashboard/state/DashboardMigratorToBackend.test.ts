import { readdirSync, readFileSync } from 'fs';
import path from 'path';

import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

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

setupDataSources(...Object.values(dataSources));

describe('Backend / Frontend result comparison', () => {
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

      // Make sure the backend output always migrates to the latest version
      expect(backendOutput.schemaVersion).toEqual(DASHBOARD_SCHEMA_VERSION);

      // Compare both migrations, when mounted in dashboard model, after serializing to JSON are the same.
      // This avoid issues with the default values in the frontend, wheter they were set in the input JSON or not.
      const frontendMigrationResult = new DashboardModel(jsonInput).getSaveModelClone();
      const backendMigrationResult = new DashboardModel(backendOutput).getSaveModelClone();
      expect(backendMigrationResult).toMatchObject(frontendMigrationResult);
    });
  });
});
