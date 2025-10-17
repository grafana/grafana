import { readdirSync, readFileSync } from 'fs';
import path from 'path';

import { transformSaveModelSchemaV2ToScene } from './transformSaveModelSchemaV2ToScene';
import { transformSaveModelToScene } from './transformSaveModelToScene';
import { transformSceneToSaveModelSchemaV2 } from './transformSceneToSaveModelSchemaV2';

// Mock the config to provide datasource information
jest.mock('@grafana/runtime', () => {
  const mockConfig = {
    ...jest.requireActual('@grafana/runtime').config,
    defaultDatasource: 'default-ds-uid',
    datasources: {
      '-- Grafana --': {
        type: 'grafana',
        uid: '-- Grafana --',
        name: 'Grafana',
        meta: { id: 'grafana' },
      },
      'existing-ref-uid': {
        type: 'prometheus',
        uid: 'existing-ref-uid',
        name: 'Prometheus',
        meta: { id: 'prometheus' },
      },
      'influxdb-uid': {
        type: 'influxdb',
        uid: 'influxdb-uid',
        name: 'InfluxDB',
        meta: { id: 'influxdb' },
      },
      'cloudwatch-uid': {
        type: 'cloudwatch',
        uid: 'cloudwatch-uid',
        name: 'CloudWatch',
        meta: { id: 'cloudwatch' },
      },
      'elasticsearch-uid': {
        type: 'elasticsearch',
        uid: 'elasticsearch-uid',
        name: 'Elasticsearch',
        meta: { id: 'elasticsearch' },
      },
      'loki-uid': {
        type: 'loki',
        uid: 'loki-uid',
        name: 'Loki',
        meta: { id: 'loki' },
      },
      'default-ds-uid': {
        type: 'prometheus',
        uid: 'default-ds-uid',
        name: 'Default Prometheus',
        meta: { id: 'prometheus' },
      },
      'existing-target-uid': {
        type: 'elasticsearch',
        uid: 'existing-target-uid',
        name: 'Elasticsearch Target',
        meta: { id: 'elasticsearch' },
      },
      'non-default-test-ds-uid': {
        type: 'loki',
        uid: 'non-default-test-ds-uid',
        name: 'Loki Test',
        meta: { id: 'loki' },
      },
    },
    featureToggles: {
      dashboardNewLayouts: true,
      kubernetesDashboards: true,
      unifiedAlertingEnabled: true,
      scopeFilters: false,
      reloadDashboardsOnParamsChange: false,
      timeComparison: false,
    },
    dashboardPerformanceMetrics: [],
    quickRanges: [],
    panelSeriesLimit: 1000,
    publicDashboardAccessToken: undefined,
  };

  return {
    ...jest.requireActual('@grafana/runtime'),
    config: mockConfig,
  };
});

/*
 * V1 to V2 Dashboard Transformation Comparison Test
 *
 * This test compares frontend and backend transformations of dashboard data from v1 to v2 format.
 * It uses the same test data as the backend conversion tests and verifies that the frontend
 * transformation produces equivalent results to the backend transformation.
 */

describe('V1 to V2 Dashboard Transformation Comparison', () => {
  beforeEach(() => {
    jest.clearAllMocks();

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
    it(`compare ${inputFile} from v1beta1 to v2beta1 backend and frontend conversions`, async () => {
      const jsonInput = JSON.parse(readFileSync(path.join(inputDir, inputFile), 'utf8'));

      // Find the corresponding v2beta1 output file
      const outputFileName = inputFile.replace('.json', `.${LATEST_API_VERSION.split('/')[1]}.json`);
      const outputFilePath = path.join(outputDir, outputFileName);

      // Load the backend output
      const backendOutput = JSON.parse(readFileSync(outputFilePath, 'utf8'));
      expect(backendOutput.apiVersion).toBe(LATEST_API_VERSION);

      // Load the backend output into a scene, then transform it back to a save model schema v2
      // This is to ensure that the backend output is the same as the frontend output being loaded by the scene
      const sceneBackend = transformSaveModelSchemaV2ToScene({
        spec: backendOutput.spec,
        metadata: backendOutput.metadata,
        apiVersion: backendOutput.apiVersion,
        access: {},
        kind: 'DashboardWithAccessInfo',
      });
      const backendOutputAfterLoadedByScene = transformSceneToSaveModelSchemaV2(sceneBackend, false);

      // Transform using frontend path: v1beta1 -> Scene -> v2beta1
      // Extract the spec from v1beta1 format and use it as the dashboard data
      // Remove snapshot field to prevent isSnapshot() from returning true
      const dashboardSpec = { ...jsonInput.spec };
      delete dashboardSpec.snapshot;

      // Wrap in DashboardDTO structure that transformSaveModelToScene expects
      const scene = transformSaveModelToScene({
        dashboard: dashboardSpec,
        meta: {
          isNew: false,
          isFolder: false,
          canSave: true,
          canEdit: true,
          canDelete: false,
          canShare: false,
          canStar: false,
          canAdmin: false,
          isSnapshot: false,
          provisioned: false,
          version: 1,
        },
      });

      const frontendOutput = transformSceneToSaveModelSchemaV2(scene, false);

      // Verify both outputs have valid spec structures
      expect(frontendOutput).toBeDefined();
      expect(backendOutputAfterLoadedByScene).toBeDefined();

      // Compare only the spec structures - this is the core transformation
      expect(backendOutputAfterLoadedByScene).toEqual(frontendOutput);
    });
  });
});
