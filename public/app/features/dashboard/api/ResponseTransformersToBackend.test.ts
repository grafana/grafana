import { readdirSync, readFileSync } from 'fs';
import path from 'path';

import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { getSceneCreationOptions } from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';
import { normalizeBackendOutputForFrontendComparison } from 'app/features/dashboard-scene/serialization/serialization-test-utils';
import { transformSaveModelSchemaV2ToScene } from 'app/features/dashboard-scene/serialization/transformSaveModelSchemaV2ToScene';
import { transformSaveModelToScene } from 'app/features/dashboard-scene/serialization/transformSaveModelToScene';
import { transformSceneToSaveModelSchemaV2 } from 'app/features/dashboard-scene/serialization/transformSceneToSaveModelSchemaV2';

import { DashboardWithAccessInfo } from './types';

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
      'influx-uid': {
        type: 'influxdb',
        uid: 'influx-uid',
        name: 'InfluxDB Test',
        meta: { id: 'influxdb' },
      },
      'cloudwatch-uid-alt': {
        type: 'cloudwatch',
        uid: 'cloudwatch-uid',
        name: 'CloudWatch Test',
        meta: { id: 'cloudwatch' },
      },
      'existing-ref': {
        type: 'prometheus',
        uid: 'existing-ref',
        name: 'Existing Ref Name',
        meta: { id: 'prometheus' },
      },
    },
    featureToggles: {
      dashboardNewLayouts: true,
      kubernetesDashboards: true,
    },
  };

  return {
    ...jest.requireActual('@grafana/runtime'),
    config: mockConfig,
  };
});

/*
 * V1 to V2 Dashboard Transformation Comparison Test (via ResponseTransformers)
 *
 * This test compares frontend and backend transformations of dashboard data from v1 to v2 format.
 * It uses the same test data as the backend conversion tests and verifies that the frontend
 * transformation produces equivalent results to the backend transformation.
 *
 * The test follows the same approach as transformSaveModelV1ToV2.test.ts:
 * - Frontend path: v1beta1 spec -> Scene -> v2beta1
 * - Backend path: v2beta1 output -> Scene -> v2beta1 (normalized)
 */

describe('V1 to V2 Dashboard Transformation Comparison (ResponseTransformers)', () => {
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

      const backendOutput = JSON.parse(readFileSync(outputFilePath, 'utf8'));
      expect(backendOutput.apiVersion).toBe(LATEST_API_VERSION);

      // Backend path: Load backend output into Scene, then serialize back to v2beta1
      // This normalizes the backend output through the same Scene
      const sceneBackend = transformSaveModelSchemaV2ToScene({
        spec: backendOutput.spec,
        metadata: backendOutput.metadata,
        apiVersion: backendOutput.apiVersion,
        access: {},
        kind: 'DashboardWithAccessInfo',
      } as DashboardWithAccessInfo<DashboardV2Spec>);
      const backendOutputAfterLoadedByScene = transformSceneToSaveModelSchemaV2(sceneBackend, false);

      // Frontend path: v1beta1 spec -> Scene -> v2beta1
      // Extract the spec from v1beta1 format and use it as the dashboard data
      // Remove snapshot field to prevent isSnapshot() from returning true
      const dashboardSpec = { ...jsonInput.spec };
      delete dashboardSpec.snapshot;

      // Wrap in DashboardDTO structure that transformSaveModelToScene expects
      const scene = transformSaveModelToScene(
        {
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
        },
        undefined,
        getSceneCreationOptions()
      );

      const frontendOutput = transformSceneToSaveModelSchemaV2(scene, false);

      // Verify both outputs have valid spec structures
      expect(frontendOutput).toBeDefined();
      expect(backendOutputAfterLoadedByScene).toBeDefined();

      // Normalize backend output to account for differences in library panel repeat handling
      // Backend sets repeat from library panel definition, frontend only sets it when explicit on instance
      const inputPanels = jsonInput.spec?.panels || [];
      const normalizedBackendOutput = normalizeBackendOutputForFrontendComparison(
        backendOutputAfterLoadedByScene,
        inputPanels
      );

      // Compare the spec structures
      expect(normalizedBackendOutput).toEqual(frontendOutput);
    });
  });
});
