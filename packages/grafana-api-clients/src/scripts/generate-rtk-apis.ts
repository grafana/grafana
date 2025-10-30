// Generates Redux Toolkit API slices for certain APIs from the OpenAPI spec
import type { ConfigFile } from '@rtk-query/codegen-openapi';
import { OpenAPIV3 } from 'openapi-types';
import path from 'path';

// Grafana root path - navigate up from this script's directory
const basePath = path.resolve(__dirname, '../../../..');

// Include some types that are used inside the @rtk-query/codegen-openapi package
// but not exported
declare const operationKeys: readonly ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];
type OperationDefinition = {
  path: string;
  verb: (typeof operationKeys)[number];
  pathItem: OpenAPIV3.PathItemObject;
  operation: OpenAPIV3.OperationObject;
};
type EndpointMatcher = string[] | ((operationName: string, operationDefinition: OperationDefinition) => boolean);

const defaultHooksOptions = {
  queries: true,
  lazyQueries: true,
  mutations: true,
};

/**
 * Helper to return consistent base API generation config
 */
const createAPIConfig = (app: string, version: string, filterEndpoints?: EndpointMatcher, additional = {}) => {
  const filePath = `../clients/rtkq/${app}/${version}/endpoints.gen.ts`;
  return {
    [filePath]: {
      schemaFile: path.join(basePath, `data/openapi/${app}.grafana.app-${version}.json`),
      apiFile: `../clients/rtkq/${app}/${version}/baseAPI.ts`,
      filterEndpoints,
      tag: true,
      hooks: defaultHooksOptions,
      ...additional,
    },
  };
};

const config: ConfigFile = {
  schemaFile: '', // leave this empty, and instead populate the outputFiles object below
  apiFile: '', // leave this empty, and instead populate the outputFiles object below
  exportName: 'generatedAPI',

  outputFiles: {
    // OpenAPI3 client with all endpoints
    '../clients/rtkq/legacy/endpoints.gen.ts': {
      schemaFile: path.join(basePath, 'public/openapi3.json'),
      hooks: defaultHooksOptions,
      tag: true,
      apiFile: '../clients/rtkq/legacy/baseAPI.ts',
      filterEndpoints: (_name, operation) => !operation.operation.deprecated,
    },
    '../clients/rtkq/migrate-to-cloud/endpoints.gen.ts': {
      schemaFile: path.join(basePath, 'public/openapi3.json'),
      apiFile: '../clients/rtkq/migrate-to-cloud/baseAPI.ts',
      hooks: defaultHooksOptions,
      filterEndpoints: [
        'getSessionList',
        'getSession',
        'deleteSession',
        'createSession',

        'getShapshotList',
        'getSnapshot',
        'uploadSnapshot',
        'createSnapshot',
        'cancelSnapshot',

        'createCloudMigrationToken',
        'deleteCloudMigrationToken',
        'getCloudMigrationToken',

        'getDashboardByUid',
        'getLibraryElementByUid',

        'getResourceDependencies',
      ],
    },
    '../clients/rtkq/preferences/user/endpoints.gen.ts': {
      schemaFile: path.join(basePath, 'public/openapi3.json'),
      hooks: defaultHooksOptions,
      apiFile: '../clients/rtkq/preferences/user/baseAPI.ts',
      filterEndpoints: ['getUserPreferences', 'updateUserPreferences', 'patchUserPreferences'],
    },
    '../clients/rtkq/user/endpoints.gen.ts': {
      schemaFile: path.join(basePath, 'public/openapi3.json'),
      hooks: defaultHooksOptions,
      apiFile: '../clients/rtkq/user/baseAPI.ts',
      filterEndpoints: ['starDashboardByUid', 'unstarDashboardByUid'],
    },
    ...createAPIConfig('advisor', 'v0alpha1'),
    ...createAPIConfig('correlations', 'v0alpha1'),
    ...createAPIConfig('dashboard', 'v0alpha1'),
    ...createAPIConfig('folder', 'v1beta1'),
    ...createAPIConfig('iam', 'v0alpha1'),
    ...createAPIConfig('playlist', 'v0alpha1'),
    ...createAPIConfig('preferences', 'v1alpha1'),
    ...createAPIConfig('provisioning', 'v0alpha1'),
    ...createAPIConfig('shorturl', 'v1alpha1'),
    // PLOP_INJECT_API_CLIENT - Used by the API client generator
  },
};

export default config;
