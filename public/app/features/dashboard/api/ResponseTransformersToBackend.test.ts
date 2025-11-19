import { readdirSync, readFileSync } from 'fs';
import path from 'path';

import {
  Spec as DashboardV2Spec,
  GridLayoutItemKind,
  RowsLayoutRowKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';
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
    uid: '-- Mixed --',
    type: 'mixed',
    isDefault: false,
  }),
  influx: mockDataSource({
    name: 'InfluxDB Test',
    uid: 'influx-uid',
    type: 'influxdb',
    isDefault: false,
  }),
  cloudwatch: mockDataSource({
    name: 'CloudWatch Test',
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

  /**
   * Normalizes backend output to match frontend behavior.
   * The backend sets repeat properties on library panel grid items from the library panel definition,
   * but the frontend only sets repeat when explicitly set on the panel instance.
   * This function removes repeat properties from library panel items where they weren't set on the instance.
   *
   * The difference in behavior is due to how the frontend conversion is done.
   * It is not feasible to fetch all library panels async in all cases where the transformation is done.
   * Library panel repeats will be set by the library panel behavior in those cases.
   */
  function normalizeBackendOutputForFrontendComparison(
    backendSpec: DashboardV2Spec,
    inputPanels: Array<{ id?: number; libraryPanel?: { uid?: string }; repeat?: string }>
  ): DashboardV2Spec {
    const normalized = JSON.parse(JSON.stringify(backendSpec)) as DashboardV2Spec;

    // Create a map of panel ID to whether it has explicit repeat
    const panelHasExplicitRepeat = new Map<number, boolean>();
    inputPanels.forEach((panel) => {
      if (panel.id !== undefined) {
        panelHasExplicitRepeat.set(panel.id, !!panel.repeat);
      }
    });

    // Helper to recursively process grid items
    function processGridItems(items: GridLayoutItemKind[]): void {
      if (!Array.isArray(items)) {
        return;
      }

      items.forEach((item) => {
        if (item.spec?.element?.name) {
          // Extract panel ID from element name (format: "panel-{id}")
          const match = item.spec.element.name.match(/^panel-(\d+)$/);
          if (match) {
            const panelId = parseInt(match[1], 10);
            const hasExplicitRepeat = panelHasExplicitRepeat.get(panelId);

            // If this is a library panel item and repeat wasn't explicitly set on the instance,
            // remove the repeat property (backend adds it from library panel definition)
            if (hasExplicitRepeat === false && item.spec.repeat) {
              delete item.spec.repeat;
            }
          }
        }
      });
    }

    // Process GridLayout items
    if (normalized.layout?.kind === 'GridLayout' && normalized.layout.spec?.items) {
      processGridItems(normalized.layout.spec.items);
    }

    // Process RowsLayout items
    if (normalized.layout?.kind === 'RowsLayout' && normalized.layout.spec?.rows) {
      normalized.layout.spec.rows.forEach((row: RowsLayoutRowKind) => {
        if (row.spec?.layout?.kind === 'GridLayout' && row.spec.layout.spec?.items) {
          processGridItems(row.spec.layout.spec.items);
        }
      });
    }

    return normalized;
  }

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

        // Normalize backend output to account for differences in library panel repeat handling
        // Backend sets repeat from library panel definition, frontend only sets it when explicit on instance
        const inputPanels = jsonInput.spec?.panels || [];
        const normalizedBackendSpec = normalizeBackendOutputForFrontendComparison(backendOutput.spec, inputPanels);

        // Compare the spec structures
        expect(normalizedBackendSpec).toEqual(frontendOutput.spec);

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
