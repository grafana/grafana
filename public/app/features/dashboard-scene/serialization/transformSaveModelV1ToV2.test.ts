import { existsSync, readFileSync } from 'fs';
import path from 'path';

import {
  getFilesRecursively,
  normalizeBackendOutputForFrontendComparison,
  removeEmptyArrays,
} from './serialization-test-utils';
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
  const migratedInput = path.join(
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
    'output',
    'latest_version'
  );
  const migratedOutput = path.join(
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
    'migrated_dashboards_output'
  );

  const LATEST_API_VERSION = 'dashboard.grafana.app/v2beta1';
  // Input versions to process (v0alpha1 and v1beta1 share the same spec structure)
  const INPUT_VERSIONS = ['v0alpha1', 'v1beta1'] as const;

  // Get v0alpha1 and v1beta1 input files recursively from all subdirectories
  const v1Inputs = getFilesRecursively(inputDir).filter(({ relativePath }) => {
    const fileName = path.basename(relativePath);
    return INPUT_VERSIONS.some((version) => fileName.startsWith(`${version}.`)) && fileName.endsWith('.json');
  });

  v1Inputs.forEach(({ filePath: inputFilePath, relativePath }) => {
    // Calculate output file path for this input
    const relativeDir = path.dirname(relativePath);
    const fileName = path.basename(relativePath);
    const outputFileName = fileName.replace('.json', `.${LATEST_API_VERSION.split('/')[1]}.json`);
    const outputFilePath =
      relativeDir === '.' ? path.join(outputDir, outputFileName) : path.join(outputDir, relativeDir, outputFileName);

    // Include output file name in test description for clarity
    const outputRelativePath = relativeDir === '.' ? outputFileName : path.join(relativeDir, outputFileName);

    it(`compare ${relativePath} → ${outputRelativePath}`, async () => {
      // Skip if output file doesn't exist
      if (!existsSync(outputFilePath)) {
        return;
      }

      const jsonInput = JSON.parse(readFileSync(inputFilePath, 'utf8'));

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

      // Determine how to extract the dashboard spec:
      // - Files with apiVersion field are API-wrapped (spec contains dashboard)
      // - Files without apiVersion are raw dashboard JSON (entire file is the spec)
      const hasApiVersion = jsonInput.apiVersion !== undefined;
      const dashboardSpec = hasApiVersion ? { ...jsonInput.spec } : { ...jsonInput };
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

      // Normalize backend output to account for differences in library panel repeat handling
      // Backend sets repeat from library panel definition, frontend only sets it when explicit on instance
      // Get input panels from appropriate location based on file format
      const inputPanels = hasApiVersion ? jsonInput.spec?.panels || [] : jsonInput.panels || [];
      const normalizedBackendOutput = removeEmptyArrays(
        normalizeBackendOutputForFrontendComparison(backendOutputAfterLoadedByScene, inputPanels)
      );

      // Also normalize frontend output to remove schema gap fields and empty arrays
      // (Go backend omits empty arrays due to omitempty, frontend preserves them)
      const normalizedFrontendOutput = removeEmptyArrays(frontendOutput);

      // Compare only the spec structures - this is the core transformation
      expect(normalizedBackendOutput).toEqual(normalizedFrontendOutput);
    });
  });

  // Test migrated dashboards (from migration pipeline output)
  const migratedJsonInputs = getFilesRecursively(migratedInput).filter(({ relativePath }) => {
    return relativePath.endsWith('.json');
  });

  migratedJsonInputs.forEach(({ filePath: inputFilePath, relativePath }) => {
    // Calculate output file path for this input
    const relativeDir = path.dirname(relativePath);
    const fileName = path.basename(relativePath);
    const outputFileName = `v1beta1-mig-${fileName.replace('.json', '')}.${LATEST_API_VERSION.split('/')[1]}.json`;
    const outputFilePath =
      relativeDir === '.'
        ? path.join(migratedOutput, outputFileName)
        : path.join(migratedOutput, relativeDir, outputFileName);

    it(`compare migrated ${relativePath} → ${outputFileName}`, async () => {
      // Read the raw dashboard JSON from migration output (latest_version directory)
      const jsonInput = JSON.parse(readFileSync(inputFilePath, 'utf8'));

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

      // Transform using frontend path: raw dashboard JSON -> Scene -> v2beta1
      // These files are raw dashboard JSON (already migrated to v42), not wrapped in v1beta1 API format
      // Remove snapshot field to prevent isSnapshot() from returning true
      const dashboardSpec = { ...jsonInput };
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

      // Normalize backend output to account for differences in library panel repeat handling
      // Backend sets repeat from library panel definition, frontend only sets it when explicit on instance
      // For migrated dashboards, panels are in the root level, not in spec.panels
      const inputPanels = jsonInput.panels || jsonInput.spec?.panels || [];
      const normalizedBackendOutput = removeEmptyArrays(
        normalizeBackendOutputForFrontendComparison(backendOutputAfterLoadedByScene, inputPanels)
      );

      // Also normalize frontend output to remove schema gap fields and empty arrays
      // (Go backend omits empty arrays due to omitempty, frontend preserves them)
      const normalizedFrontendOutput = removeEmptyArrays(frontendOutput);

      // Compare only the spec structures - this is the core transformation
      expect(normalizedBackendOutput).toEqual(normalizedFrontendOutput);
    });
  });
});
