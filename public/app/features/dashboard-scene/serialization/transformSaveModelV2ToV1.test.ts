import { readdirSync, readFileSync } from 'fs';
import path from 'path';

import { transformSaveModelSchemaV2ToScene } from './transformSaveModelSchemaV2ToScene';
import { transformSaveModelToScene } from './transformSaveModelToScene';
import { transformSceneToSaveModel } from './transformSceneToSaveModel';

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
      '-- Mixed --': {
        type: 'mixed',
        uid: '-- Mixed --',
        name: '-- Mixed --',
        meta: { id: 'mixed' },
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
 * V2 to V1 Dashboard Transformation Comparison Test
 *
 * This test compares frontend and backend transformations of dashboard data from v2alpha1 to v1beta1 format.
 * It uses the same test data as the backend conversion tests and verifies that the frontend
 * transformation produces equivalent results to the backend transformation.
 *
 * Note: The backend conversion is tested separately in Go tests. This test ensures that the frontend
 * transformation (v2alpha1 → Scene → v1beta1) produces results that match the backend transformation.
 */

describe('V2 to V1 Dashboard Transformation Comparison', () => {
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

  // Filter to only process v2beta1 input files
  const v2beta1Inputs = jsonInputs.filter((inputFile) => inputFile.startsWith('v2beta1.'));

  v2beta1Inputs.forEach((inputFile) => {
    it(`compare ${inputFile} from v2beta1 to v1beta1 backend and frontend conversions`, async () => {
      const jsonInput = JSON.parse(readFileSync(path.join(inputDir, inputFile), 'utf8'));

      // Find the corresponding v1beta1 output file
      const outputFileName = inputFile.replace('.json', '.v1beta1.json');
      const outputFilePath = path.join(outputDir, outputFileName);

      // Load the backend output
      const backendOutput = JSON.parse(readFileSync(outputFilePath, 'utf8'));

      // Load the backend v1beta1 output into a scene, then transform it back to v1beta1
      // This is to ensure that the backend output is the same as the frontend output being loaded by the scene
      const backendDashboardSpec = backendOutput.spec?.dashboard || backendOutput.spec;
      const sceneBackend = transformSaveModelToScene({
        dashboard: backendDashboardSpec,
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
      const backendOutputAfterLoadedByScene = transformSceneToSaveModel(sceneBackend, false);

      // Transform using frontend path: v2beta1 -> Scene -> v1beta1
      // Extract the spec from v2beta1 format and use it as the dashboard data
      // Remove snapshot field to prevent isSnapshot() from returning true
      const dashboardSpec = { ...jsonInput.spec };
      delete dashboardSpec.snapshot;

      // Load v2beta1 into Scene (frontend can handle v2beta1)
      const scene = transformSaveModelSchemaV2ToScene({
        spec: dashboardSpec,
        metadata: jsonInput.metadata || {
          name: 'test-dashboard',
          generation: 1,
          resourceVersion: '1',
          creationTimestamp: new Date().toISOString(),
        },
        apiVersion: jsonInput.apiVersion || LATEST_API_VERSION,
        access: {},
        kind: 'DashboardWithAccessInfo',
      });

      // Transform Scene to v1beta1 using frontend transformation
      const frontendOutput = transformSceneToSaveModel(scene, false);

      // Verify both outputs have valid spec structures
      expect(frontendOutput).toBeDefined();
      expect(backendOutputAfterLoadedByScene).toBeDefined();

      // Compare only the dashboard spec structures, ignoring metadata differences (uid, version, etc.)
      // Remove metadata fields that may differ between backend and frontend transformations
      const frontendSpec = { ...frontendOutput };
      const backendSpec = { ...backendOutputAfterLoadedByScene };
      
      // Remove metadata fields that are not part of the core dashboard spec
      delete frontendSpec.uid;
      delete backendSpec.uid;
      delete frontendSpec.version;
      delete backendSpec.version;
      delete frontendSpec.id;
      delete backendSpec.id;

      // Compare only the spec structures - this is the core transformation
      expect(backendSpec).toEqual(frontendSpec);
    });
  });
});
