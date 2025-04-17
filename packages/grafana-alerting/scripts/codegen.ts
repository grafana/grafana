/**
 * This script will generate TypeScript type definitions and a RTKQ client for the alerting k8s APIs.
 * It downloads the OpenAPI schema from a running Grafana instance and generates the types.
 *
 * Run `yarn run codegen` from the "grafana-alerting" package to invoke this script.
 */
import { type ConfigFile } from '@rtk-query/codegen-openapi';
import { resolve } from 'node:path';

// make sure to run the Grafana server before running this script since it will download the OpenAPI schema from the server
const OPENAPI_SCHEMA_LOCATION = resolve(
  '../../../pkg/tests/apis/openapi_snapshots/notifications.alerting.grafana.app-v0alpha1.json'
);

export default {
  exportName: 'alertingAPI',
  schemaFile: OPENAPI_SCHEMA_LOCATION,
  apiFile: '../src/grafana/api.ts',
  outputFile: resolve('../src/grafana/api.gen.ts'),
  tag: true,
} satisfies ConfigFile;
