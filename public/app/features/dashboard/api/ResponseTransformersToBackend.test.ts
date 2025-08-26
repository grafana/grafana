import { readdirSync, readFileSync } from 'fs';
import path from 'path';

import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

import { ensureV2Response } from './ResponseTransformers';

// Mock the config to provide datasource information
jest.mock('@grafana/runtime', () => {
  const mockConfig = {
    ...jest.requireActual('@grafana/runtime').config,
    defaultDatasource: 'default-ds-uid',
    datasources: {
      'default-ds-uid': {
        meta: { id: 'prometheus' },
        name: 'default-ds-uid',
      },
      'non-default-test-ds-uid': {
        meta: { id: 'loki' },
        name: 'non-default-test-ds-uid',
      },
      'existing-ref-uid': {
        meta: { id: 'prometheus' },
        name: 'existing-ref-uid',
      },
      'existing-target-uid': {
        meta: { id: 'elasticsearch' },
        name: 'existing-target-uid',
      },
      'existing-ref': {
        meta: { id: 'prometheus' },
        name: 'existing-ref',
      },
      '-- Mixed --': {
        meta: { id: 'mixed' },
        name: '-- Mixed --',
      },
      'influx-uid': {
        meta: { id: 'influxdb' },
        name: 'influx-uid',
      },
      'cloudwatch-uid': {
        meta: { id: 'cloudwatch' },
        name: 'cloudwatch-uid',
      },
      '-- Grafana --': {
        meta: { id: 'grafana' },
        name: '-- Grafana --',
      },
    },
    apps: {},
    featureToggles: {
      dashboardScene: true,
      kubernetesDashboards: true,
    },
  };

  return {
    ...jest.requireActual('@grafana/runtime'),
    config: mockConfig,
  };
});

/*
 * Frontend Conversion Test Design Explanation:
 *
 * This test verifies that the frontend ensureV2Response function correctly converts
 * dashboard data to v2beta1 format. The test uses input files from the backend test suite
 * and compares the frontend conversion results with expected backend conversion results.
 *
 * Note: The frontend ensureV2Response function is designed to convert legacy dashboard
 * format to v2 format, while the backend handles Kubernetes resource format conversions.
 * This test focuses on verifying the frontend conversion logic works correctly.
 */

// Set up the same datasources as backend test provider to ensure consistency
const dataSources = {
  default: mockDataSource({
    name: 'default-ds-uid',
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
  influx: mockDataSource({
    name: 'InfluxDB Test Datasource',
    uid: 'influx-uid',
    type: 'influxdb',
    isDefault: false,
  }),
  cloudwatch: mockDataSource({
    name: 'CloudWatch Test Datasource',
    uid: 'cloudwatch-uid',
    type: 'cloudwatch',
    isDefault: false,
  }),
  grafana: mockDataSource({
    name: '-- Grafana --',
    uid: '-- Grafana --',
    type: 'grafana',
    isDefault: false,
  }),
};

describe('Backend / Frontend result comparison', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDataSources(...Object.values(dataSources));

    // Mock console methods to avoid test failures from expected warnings
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
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
    'conversion',
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
    'conversion',
    'testdata',
    'output'
  );

  const jsonInputs = readdirSync(inputDir);
  const LATEST_API_VERSION = 'dashboard.grafana.app/v2beta1';

  // Filter to only process v1beta1 input files
  const v1beta1Inputs = jsonInputs.filter((inputFile) => inputFile.startsWith('v1beta1.'));

  v1beta1Inputs.forEach((inputFile) => {
    it(`should convert ${inputFile} spec to match backend conversion`, async () => {
      const jsonInput = JSON.parse(readFileSync(path.join(inputDir, inputFile), 'utf8'));

      // Find the corresponding v2beta1 output file
      const outputFileName = inputFile.replace('.json', `.${LATEST_API_VERSION.split('/')[1]}.json`);
      const outputFilePath = path.join(outputDir, outputFileName);

      // Check if the expected output file exists
      try {
        const backendOutput = JSON.parse(readFileSync(outputFilePath, 'utf8'));
        expect(backendOutput.apiVersion).toBe(LATEST_API_VERSION);

        // Create dashboard models using frontend conversion
        // ensureV2Response expects DashboardWithAccessInfo object
        const frontendOutput = ensureV2Response({
          ...jsonInput,
          kind: 'DashboardWithAccessInfo',
          access: {},
        });

        // Verify both outputs have valid spec structures
        expect(frontendOutput.spec).toBeDefined();
        expect(backendOutput.spec).toBeDefined();

        // Compare the spec structures
        expect(backendOutput.spec).toMatchObject(frontendOutput.spec);

        // Verify the conversion doesn't throw errors and produces a valid structure
        expect(() => JSON.stringify(frontendOutput)).not.toThrow();
      } catch (error) {
        if (error instanceof Error && error.message.includes('ENOENT')) {
          // Skip test if output file doesn't exist
          console.warn(`Skipping test for ${inputFile} - no corresponding v2beta1 output file found`);
          return;
        }
        throw error;
      }
    });
  });
});
