import { readdirSync } from 'fs';
import path from 'path';

import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

// Set up the same datasources as backend test provider to ensure consistency
export const dataSources = {
  default: mockDataSource({
    name: 'Default Test Datasource Name',
    uid: 'default-ds-uid',
    type: 'prometheus',
    isDefault: true,
    apiVersion: 'v1',
  }),
  nonDefault: mockDataSource({
    name: 'Non Default Test Datasource Name',
    uid: 'non-default-test-ds-uid',
    type: 'loki',
    isDefault: false,
    apiVersion: 'v1',
  }),
  existingRef: mockDataSource({
    name: 'Existing Ref Name',
    uid: 'existing-ref-uid',
    type: 'prometheus',
    isDefault: false,
    apiVersion: 'v1',
  }),
  existingTarget: mockDataSource({
    name: 'Existing Target Name',
    uid: 'existing-target-uid',
    type: 'elasticsearch',
    isDefault: false,
    apiVersion: 'v2',
  }),
  existingRefAlt: mockDataSource({
    name: 'Existing Ref Name',
    uid: 'existing-ref',
    type: 'prometheus',
    isDefault: false,
    apiVersion: 'v1',
  }),
  mixed: mockDataSource({
    name: MIXED_DATASOURCE_NAME,
    type: 'mixed',
    uid: MIXED_DATASOURCE_NAME,
    isDefault: false,
    apiVersion: 'v1',
  }),
};

// Separate datasource setup for dev-dashboards which primarily use testdata datasource
export const devDashboardDataSources = {
  // Add datasource that can be found by type name for migration resolution
  testdataByType: mockDataSource(
    {
      name: 'grafana-testdata-datasource',
      uid: 'testdata-type-uid',
      type: 'grafana-testdata-datasource',
      apiVersion: 'v1',
      isDefault: true,
    },
    {
      metrics: true,
      annotations: true,
      logs: true,
    }
  ),
  testdata: mockDataSource(
    {
      name: 'TestData',
      uid: 'testdata',
      type: 'grafana-testdata-datasource',
      isDefault: false,
    },
    {
      metrics: true,
      annotations: true,
      logs: true,
    }
  ),
  prometheus: mockDataSource({
    name: 'Prometheus',
    uid: 'prometheus-uid',
    type: 'prometheus',
    apiVersion: 'v1',
    isDefault: false,
  }),
  loki: mockDataSource({
    name: 'Loki',
    uid: 'loki-uid',
    type: 'loki',
    apiVersion: 'v1',
    isDefault: false,
  }),
  elasticsearch: mockDataSource({
    name: 'Elasticsearch',
    uid: 'elasticsearch-uid',
    type: 'elasticsearch',
    apiVersion: 'v1',
    isDefault: false,
  }),
  mixed: mockDataSource({
    name: MIXED_DATASOURCE_NAME,
    type: 'mixed',
    uid: MIXED_DATASOURCE_NAME,
    apiVersion: 'v1',
    isDefault: false,
  }),
};

export function setupTestDataSources() {
  setupDataSources(...Object.values(dataSources));
}

export function setupDevDashboardDataSources() {
  setupDataSources(...Object.values(devDashboardDataSources));
}

export function getTestDirectories() {
  const inputDir = path.join(
    __dirname,
    '..',
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

  return { inputDir };
}

export function getOutputDirectory(outputType: 'single_version' | 'latest_version') {
  return path.join(
    __dirname,
    '..',
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
    outputType
  );
}

export function getJsonInputFiles(inputDir: string) {
  return readdirSync(inputDir).filter((inputFile) => inputFile.endsWith('.json'));
}

export function extractTargetVersionFromFilename(filename: string): number | null {
  const versionMatch = filename.match(/^v(\d+)\.(.+)\.json$/);
  if (!versionMatch) {
    return null;
  }
  return parseInt(versionMatch[1], 10);
}

export function constructBackendOutputFilename(inputFile: string, targetVersion: number): string {
  return inputFile.replace('.json', `.v${targetVersion}.json`);
}

export function constructLatestVersionOutputFilename(inputFile: string, latestVersion: number): string {
  return inputFile.replace('.json', `.v${latestVersion}.json`);
}
