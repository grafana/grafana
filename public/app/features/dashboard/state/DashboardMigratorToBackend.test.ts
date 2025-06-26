import { readdirSync, readFileSync } from 'fs';
import path from 'path';

import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

import { DASHBOARD_SCHEMA_VERSION } from './DashboardMigrator';
import { DashboardModel } from './DashboardModel';

// Set up the same datasources as DashboardMigrator.test.ts to ensure consistency
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

      // Parse the input filename to get the version and name
      const parts = inputFile.split('.');
      const inputVersion = parts[0];
      const name = parts.slice(1, -1).join('.');

      // Construct output filename using the new naming convention: {inputVersion}.{name}.json
      const outputFileName = `${inputVersion}.${name}.json`;

      const backendOutput = JSON.parse(readFileSync(path.join(outputDir, outputFileName), 'utf8'));

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
