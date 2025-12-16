import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
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
      '-- Grafana --': { type: 'grafana', uid: '-- Grafana --', name: 'Grafana', meta: { id: 'grafana' } },
      'existing-ref-uid': {
        type: 'prometheus',
        uid: 'existing-ref-uid',
        name: 'Prometheus',
        meta: { id: 'prometheus' },
      },
      'influxdb-uid': { type: 'influxdb', uid: 'influxdb-uid', name: 'InfluxDB', meta: { id: 'influxdb' } },
      'cloudwatch-uid': { type: 'cloudwatch', uid: 'cloudwatch-uid', name: 'CloudWatch', meta: { id: 'cloudwatch' } },
      'elasticsearch-uid': {
        type: 'elasticsearch',
        uid: 'elasticsearch-uid',
        name: 'Elasticsearch',
        meta: { id: 'elasticsearch' },
      },
      'loki-uid': { type: 'loki', uid: 'loki-uid', name: 'Loki', meta: { id: 'loki' } },
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
      '-- Mixed --': { type: 'mixed', uid: '-- Mixed --', name: '-- Mixed --', meta: { id: 'mixed' } },
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
 * This test ensures that the frontend and backend v2beta1→v1beta1/v0alpha1 conversions produce identical outputs
 * after being normalized through the same Scene load/save cycle.
 *
 * ## Two Conversion Paths Being Compared:
 *
 * ### BACKEND PATH (simulates: API returns v1beta1 or v0alpha1, UI loads it, user saves)
 * 1. Go conversion: v2beta1 → v1beta1 or v0alpha1 (output file from backend tests)
 * 2. Load into Scene: v1/v0 JSON → DashboardModel → Scene
 * 3. Serialize back: Scene → v1beta1 JSON (transformSceneToSaveModel)
 *
 * ### FRONTEND PATH (simulates: API returns v2beta1, UI loads it, user saves)
 * 1. Load v2beta1 into Scene: v2beta1 → Scene (transformSaveModelSchemaV2ToScene)
 * 2. Serialize to v1: Scene → v1beta1 JSON (transformSceneToSaveModel)
 * 3. Normalize: v1beta1 JSON → Scene → v1beta1 JSON (same as backend step 2-3)
 *
 * ## Why Normalize Both?
 * Both paths end with the same Scene load/save cycle (via loadAndSerializeV1SaveModel).
 * This simulates what would happen if a user loaded a dashboard
 * and saved it without changes. The Scene processing may add default values, reorder fields, or
 * normalize data structures - by running both outputs through the same normalization, we eliminate
 * these differences and focus on the actual conversion logic.
 *
 * ## Why Include v0alpha1?
 * v0alpha1 and v1beta1 share the same spec structure. The v0alpha1 output from v2beta1→v0alpha1
 * conversion should produce identical results when loaded by the Scene. This validates that
 * the backend v2→v0 conversion is consistent with the v2→v1 conversion.
 *
 * ## Expected Outcome
 * Both paths should produce identical v1beta1 JSON after normalization, meaning:
 * - The backend Go conversion produces correct v1beta1/v0alpha1 that survives Scene load/save unchanged
 * - The frontend v2→v1 conversion produces v1beta1 matching what backend would produce
 */

// Target versions to compare (v0alpha1 and v1beta1 share the same spec structure)
const TARGET_VERSIONS = ['v0alpha1', 'v1beta1'] as const;

describe('V2 to V1 Dashboard Transformation Comparison', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  // Get v2beta1 input files
  const v2beta1Inputs = getFilesRecursively(inputDir).filter(({ relativePath }) => {
    const fileName = path.basename(relativePath);
    return fileName.startsWith('v2beta1.') && fileName.endsWith('.json');
  });

  // Test each input file against each target version
  v2beta1Inputs.forEach(({ filePath: inputFilePath, relativePath }) => {
    TARGET_VERSIONS.forEach((targetVersion) => {
      it(`${relativePath} → ${targetVersion}`, () => {
        const relativeDir = path.dirname(relativePath);
        const fileName = path.basename(relativePath);
        const outputFileName = fileName.replace('.json', `.${targetVersion}.json`);
        const outputFilePath =
          relativeDir === '.'
            ? path.join(outputDir, outputFileName)
            : path.join(outputDir, relativeDir, outputFileName);

        // Skip if output file doesn't exist
        if (!existsSync(outputFilePath)) {
          return;
        }

        const jsonInput = JSON.parse(readFileSync(inputFilePath, 'utf8'));
        const backendOutput = JSON.parse(readFileSync(outputFilePath, 'utf8'));

        // Backend path: Load backend output through Scene
        const backendSpec = loadAndSerializeV1SaveModel(backendOutput.spec);

        // Frontend path: Transform v2beta1 through Scene
        const frontendSpec = transformV2ToV1UsingFrontendTransformers(jsonInput);

        // Compare specs (excluding metadata fields)
        expect(removeMetadata(backendSpec)).toEqual(removeMetadata(frontendSpec));
      });
    });
  });
});

/** Remove metadata fields that differ between backend and frontend transformations */
function removeMetadata(spec: Dashboard): Partial<Dashboard> {
  const { uid, version, id, ...rest } = spec;
  return rest;
}

/**
 * Loads a v1beta1/v0alpha1 dashboard into Scene and serializes it back to v1beta1.
 *
 * This simulates the real-world flow when editing a dashboard:
 * v1beta1 JSON → DashboardModel → Scene → v1beta1 JSON
 *
 * This function is used to normalize both backend and frontend outputs through the same
 * Scene load/save cycle. The Scene may add default values, reorder fields,
 * or normalize data structures - this function ensures both outputs go through
 * identical processing.
 */
function loadAndSerializeV1SaveModel(dashboard: Dashboard): Dashboard {
  const scene = transformSaveModelToScene({
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

  return transformSceneToSaveModel(scene, false);
}

/**
 * Transforms v2beta1 to v1beta1 using the frontend conversion pipeline.
 *
 * Pipeline: v2beta1 → Scene → v1beta1 → Scene → v1beta1 (normalized)
 *
 * The final normalization step (passing through loadAndSerializeV1SaveModel) ensures
 * the output goes through the same Scene load/save cycle as the backend output,
 * making the comparison fair.
 */
function transformV2ToV1UsingFrontendTransformers(jsonInput: DashboardWithAccessInfo<DashboardV2Spec>): Dashboard {
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

  const frontendOutput = transformSceneToSaveModel(scene, false);
  return loadAndSerializeV1SaveModel(frontendOutput);
}
