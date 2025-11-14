import { readdirSync, readFileSync } from 'fs';
import path from 'path';

import { transformSaveModelSchemaV2ToScene } from './transformSaveModelSchemaV2ToScene';
import { transformSceneToSaveModelSchemaV2 } from './transformSceneToSaveModelSchemaV2';
import { transformDashboardV2SpecToV1 } from '../../api/ResponseTransformers';

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
  const V2ALPHA1_API_VERSION = 'dashboard.grafana.app/v2alpha1';
  const V1BETA1_API_VERSION = 'dashboard.grafana.app/v1beta1';

  // Filter to only process v2alpha1 input files
  const v2alpha1Inputs = jsonInputs.filter((inputFile) => inputFile.startsWith('v2alpha1.'));

  v2alpha1Inputs.forEach((inputFile) => {
    it(`compare ${inputFile} from v2alpha1 to v1beta1 backend and frontend conversions`, async () => {
      const jsonInput = JSON.parse(readFileSync(path.join(inputDir, inputFile), 'utf8'));

      // Find the corresponding v1beta1 output file
      const outputFileName = inputFile.replace('.json', `.${V1BETA1_API_VERSION.split('/')[1]}.json`);
      const outputFilePath = path.join(outputDir, outputFileName);

      // Load the backend output (if it exists)
      let backendOutput: any;
      try {
        backendOutput = JSON.parse(readFileSync(outputFilePath, 'utf8'));
        expect(backendOutput.apiVersion).toBe(V1BETA1_API_VERSION);
      } catch (err) {
        // Backend output file doesn't exist yet - skip this test
        // The backend test will generate it
        return;
      }

      // Extract the dashboard spec from backend v1beta1 output
      // v1beta1 format wraps the dashboard in spec.dashboard
      const backendDashboardSpec = backendOutput.spec?.dashboard || backendOutput.spec;

      // Transform using frontend path: v2alpha1 -> Scene -> v1beta1
      // Load v2alpha1 into a scene first
      const scene = transformSaveModelSchemaV2ToScene({
        spec: jsonInput.spec,
        metadata: jsonInput.metadata || {
          name: 'test-dashboard',
          generation: 1,
          resourceVersion: '1',
          creationTimestamp: new Date().toISOString(),
        },
        apiVersion: V2ALPHA1_API_VERSION,
        access: {},
        kind: 'DashboardWithAccessInfo',
      });

      // Transform scene to v2alpha1 spec (to ensure we have the correct format)
      const v2alpha1Spec = transformSceneToSaveModelSchemaV2(scene, false);

      // Transform v2alpha1 spec to v1beta1 using frontend transformation
      const frontendDashboardSpec = transformDashboardV2SpecToV1(v2alpha1Spec, {
        name: jsonInput.metadata?.name || 'test-dashboard',
        generation: jsonInput.metadata?.generation || 1,
        resourceVersion: jsonInput.metadata?.resourceVersion || '1',
        creationTimestamp: jsonInput.metadata?.creationTimestamp || new Date().toISOString(),
      });

      // Verify both outputs have valid spec structures
      expect(frontendDashboardSpec).toBeDefined();
      expect(backendDashboardSpec).toBeDefined();

      // Compare key fields - since v1beta1 is unstructured, we compare the JSON structure
      expect(frontendDashboardSpec.title).toBe(backendDashboardSpec.title);
      expect(frontendDashboardSpec.description).toBe(backendDashboardSpec.description);
      expect(frontendDashboardSpec.tags).toEqual(backendDashboardSpec.tags);

      // Compare panels count
      const frontendPanels = frontendDashboardSpec.panels || [];
      const backendPanels = backendDashboardSpec.panels || [];
      expect(frontendPanels.length).toBe(backendPanels.length);

      // Compare variables count
      const frontendVars = frontendDashboardSpec.templating?.list || [];
      const backendVars = backendDashboardSpec.templating?.list || [];
      expect(frontendVars.length).toBe(backendVars.length);

      // Compare annotations count
      const frontendAnn = frontendDashboardSpec.annotations?.list || [];
      const backendAnn = backendDashboardSpec.annotations?.list || [];
      expect(frontendAnn.length).toBe(backendAnn.length);

      // Compare time settings
      expect(frontendDashboardSpec.time?.from).toBe(backendDashboardSpec.time?.from);
      expect(frontendDashboardSpec.time?.to).toBe(backendDashboardSpec.time?.to);
      expect(frontendDashboardSpec.timezone).toBe(backendDashboardSpec.timezone);
      expect(frontendDashboardSpec.refresh).toBe(backendDashboardSpec.refresh);
    });
  });
});

