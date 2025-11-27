import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

import { Dashboard } from '@grafana/schema';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { DashboardDataDTO } from 'app/types/dashboard';

import { transformSaveModelSchemaV2ToScene } from './transformSaveModelSchemaV2ToScene';
import { transformSaveModelToScene } from './transformSaveModelToScene';
import { transformSceneToSaveModel } from './transformSceneToSaveModel';


// Helper function to recursively get all files from a directory
function getFilesRecursively(dir: string, baseDir: string = dir): Array<{ filePath: string; relativePath: string }> {
  const files: Array<{ filePath: string; relativePath: string }> = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...getFilesRecursively(fullPath, baseDir));
    } else if (entry.endsWith('.json')) {
      files.push({
        filePath: fullPath,
        relativePath: path.relative(baseDir, fullPath),
      });
    }
  }

  return files;
}

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
 * This test ensures that the frontend and backend v2beta1→v1beta1 conversions produce identical outputs
 * after being normalized through the same Scene load/save cycle.
 *
 * ## Two Conversion Paths Being Compared:
 *
 * ### BACKEND PATH (simulates: API returns v1beta1, UI loads it, user saves)
 * 1. Go conversion: v2beta1 → v1beta1 (output file from backend tests)
 * 2. Load into Scene: v1beta1 JSON → DashboardModel → Scene
 * 3. Serialize back: Scene → v1beta1 JSON (transformSceneToSaveModel)
 *
 * ### FRONTEND PATH (simulates: API returns v2beta1, UI loads it, user saves)
 * 1. Load v2beta1 into Scene: v2beta1 → Scene (transformSaveModelSchemaV2ToScene)
 * 2. Serialize to v1: Scene → v1beta1 JSON (transformSceneToSaveModel)
 * 3. Normalize: v1beta1 JSON → Scene → v1beta1 JSON (same as backend step 2-3)
 *
 * ## Why Normalize Both?
 * Both paths end with the same Scene load/save cycle to ensure we're comparing apples to apples.
 * This simulates what would happen if a user loaded a dashboard and saved it without changes.
 *
 * ## Expected Outcome
 * Both paths should produce identical v1beta1 JSON after normalization, meaning:
 * - The backend Go conversion produces correct v1beta1 that survives Scene load/save unchanged
 * - The frontend v2→v1 conversion produces v1beta1 matching what backend would produce
 */

describe('V2 to V1 Dashboard Transformation Comparison', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console methods to avoid test failures from expected warnings (but keep console.log for debugging)
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

  // Get all files recursively from input directory
  const allFiles = getFilesRecursively(inputDir);

  // Filter to only process v2beta1 input files
  const v2beta1Inputs = allFiles.filter(({ relativePath }) => {
    const fileName = path.basename(relativePath);
    return fileName.startsWith('v2beta1.') && fileName.endsWith('.json');
  });

  v2beta1Inputs.forEach(({ filePath: inputFilePath, relativePath }) => {
    it(`compare ${relativePath} from v2beta1 to v1beta1 backend and frontend conversions`, async () => {
      const jsonInput = JSON.parse(readFileSync(inputFilePath, 'utf8'));

      // Find the corresponding v1beta1 output file (preserving subdirectory structure)
      const relativeDir = path.dirname(relativePath);
      const fileName = path.basename(relativePath);
      const outputFileName = fileName.replace('.json', '.v1beta1.json');
      const outputFilePath =
        relativeDir === '.' ? path.join(outputDir, outputFileName) : path.join(outputDir, relativeDir, outputFileName);

      // Load the backend output
      const backendOutput = JSON.parse(readFileSync(outputFilePath, 'utf8'));

      // BACKEND PATH:
      // Go conversion (v2beta1 → v1beta1) → load into Scene → serialize back
      // This simulates: API returns v1beta1 → UI loads it → user saves changes
      const backendDashboardSpec = backendOutput.spec?.dashboard || backendOutput.spec;
      const backendOutputAfterLoadedByScene = loadAndSerializeV1SaveModel(backendDashboardSpec);

      // Transform using frontend path: v2beta1 -> Scene -> v1beta1
      // Extract the spec from v2beta1 format and use it as the dashboard data
      // Remove snapshot field to prevent isSnapshot() from returning true
      const frontendOutputAfterLoadedByScene = transformV2ToV1UsingFrontendTransformers(jsonInput);

      // Verify both outputs have valid spec structures
      expect(frontendOutputAfterLoadedByScene).toBeDefined();
      expect(backendOutputAfterLoadedByScene).toBeDefined();

      // Compare only the dashboard spec structures, ignoring metadata differences (uid, version, etc.)
      // Remove metadata fields that may differ between backend and frontend transformations
      const frontendSpec = { ...frontendOutputAfterLoadedByScene };
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

/*
 * Simulate the frontend transformation of a dashboard data object to a v1beta1 dashboard data object
 * This is to ensure that the frontend transformation produces the same result as the backend transformation
 * when the dashboard data object is loaded by the scene.
 */
/*
 * Loads a v1beta1 dashboard into Scene and serializes it back to v1beta1.
 * 
 * This simulates the real-world flow when editing a dashboard:
 * v1beta1 JSON → DashboardModel → Scene → v1beta1 JSON
 * 
 * This function is used to normalize both backend and frontend outputs
 * through the same Scene load/save cycle, ensuring we compare apples to apples.
 */
function loadAndSerializeV1SaveModel(dashboard: Dashboard): Dashboard {
  const sceneBackend = transformSaveModelToScene({
    dashboard: dashboard as DashboardDataDTO,
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

  return backendOutputAfterLoadedByScene;
}

/*
 * FRONTEND PATH:
 * Transforms v2beta1 to v1beta1 using the frontend conversion pipeline:
 * v2beta1 input → Scene (via transformSaveModelSchemaV2ToScene) → v1beta1 (via transformSceneToSaveModel)
 * 
 * Then passes through loadAndSerializeV1SaveModel to normalize with the same Scene load/save
 * cycle that the backend output goes through. This ensures both paths are compared after
 * the same normalization process.
 */
function transformV2ToV1UsingFrontendTransformers(jsonInput: DashboardWithAccessInfo<DashboardV2Spec>): Dashboard {

  // Step 1: Load v2beta1 into Scene
  const scene = transformSaveModelSchemaV2ToScene({
    spec: jsonInput.spec,
    metadata: jsonInput.metadata || {
      name: 'test-dashboard',
      generation: 1,
      resourceVersion: '1',
      creationTimestamp: new Date().toISOString(),
    },
    apiVersion: jsonInput.apiVersion,
    access: {},
    kind: 'DashboardWithAccessInfo',
  });
  
  // Step 2: Transform Scene to v1beta1
  const frontendOutput = transformSceneToSaveModel(scene, false);

  // Step 3: Normalize by passing through Scene load/save (same as backend path)
  // This ensures both paths are compared after identical Scene processing
  const frontendOutputAfterLoadedByScene = loadAndSerializeV1SaveModel(frontendOutput);
  
  return frontendOutputAfterLoadedByScene;
}
