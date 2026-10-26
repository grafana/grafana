// Generates Redux Toolkit API slices for certain APIs from the OpenAPI spec
import type { ConfigFile } from '@rtk-query/codegen-openapi';
import { type OpenAPIV3 } from 'openapi-types';
import path from 'path';

// Grafana root path - navigate up from this script's directory
const basePath = path.resolve(__dirname, '../../../..');

// Include some types that are used inside the @rtk-query/codegen-openapi package
// but not exported
declare const operationKeys: readonly ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];
export type OperationDefinition = {
  path: string;
  verb: (typeof operationKeys)[number];
  pathItem: OpenAPIV3.PathItemObject;
  operation: OpenAPIV3.OperationObject;
};
export type EndpointMatcher = string[] | ((operationName: string, operationDefinition: OperationDefinition) => boolean);

const defaultHooksOptions = {
  queries: true,
  lazyQueries: true,
  mutations: true,
};

// Generic search routes are generated only when a frontend consumer opts in.
// The older group-root dashboard search routes remain included.
const perResourceSearch = /^\/[^/]+\/(search(?:\/hybrid)?|trash)$/;

export const withoutPerResourceSearch = (filterEndpoints?: EndpointMatcher): EndpointMatcher => {
  if (Array.isArray(filterEndpoints)) {
    return filterEndpoints;
  }
  return (name, operation) =>
    !perResourceSearch.test(operation.path) && (filterEndpoints ? filterEndpoints(name, operation) : true);
};

/**
 * Helper to return consistent base API generation config
 */
const createAPIConfig = (app: string, version: string, filterEndpoints?: EndpointMatcher, additional = {}) => {
  const filePath = `../clients/rtkq/${app}/${version}/endpoints.gen.ts`;
  return {
    [filePath]: {
      schemaFile: path.join(basePath, `packages/grafana-openapi/src/apis/${app}.grafana.app-${version}.json`),
      apiFile: `../clients/rtkq/${app}/${version}/baseAPI.ts`,
      filterEndpoints: withoutPerResourceSearch(filterEndpoints),
      tag: true,
      hooks: defaultHooksOptions,
      ...additional,
    },
  };
};

/**
 * Includes the hybrid search endpoint in the generated APIs, in contrast to createAPIConfig which filters them out.
 */
const createAPIConfigWithSearch = (app: string, version: string) =>
  createAPIConfig(app, version, undefined, {
    // Disable the default search-route filter.
    filterEndpoints: undefined,
    // Generic search and trash use POSTs to read resources, which by default would be considered a mutation by RTK,
    // so we have to make this override.
    endpointOverrides: [
      {
        pattern: (_name: string, operation: OperationDefinition) =>
          operation.verb === 'post' && perResourceSearch.test(operation.path),
        type: 'query',
      },
    ],
  });

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
      endpointOverrides: [
        {
          pattern: 'listTeamsRoles',
          type: 'query',
        },
      ],
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
    '../clients/rtkq/preferences/org/endpoints.gen.ts': {
      schemaFile: path.join(basePath, 'public/openapi3.json'),
      hooks: defaultHooksOptions,
      apiFile: '../clients/rtkq/preferences/org/baseAPI.ts',
      filterEndpoints: ['getOrgPreferences', 'updateOrgPreferences', 'patchOrgPreferences'],
    },
    '../clients/rtkq/preferences/team/endpoints.gen.ts': {
      schemaFile: path.join(basePath, 'public/openapi3.json'),
      hooks: defaultHooksOptions,
      apiFile: '../clients/rtkq/preferences/team/baseAPI.ts',
      filterEndpoints: ['getTeamPreferences', 'updateTeamPreferences', 'patchTeamPreferences'],
    },
    ...createAPIConfig('advisor', 'v0alpha1'),
    ...createAPIConfig('correlations', 'v0alpha1'),
    ...createAPIConfigWithSearch('dashboard', 'v0alpha1'),
    ...createAPIConfig('dashboard', 'v1beta1'),
    ...createAPIConfig('dashboard', 'v2beta1'),
    ...createAPIConfig('dashboard', 'v2'),
    ...createAPIConfig('folder', 'v1beta1'),
    ...createAPIConfig('iam', 'v0alpha1'),
    ...createAPIConfig('playlist', 'v1'),
    ...createAPIConfig('collections', 'v1alpha1'),
    ...createAPIConfig('preferences', 'v1alpha1'),
    ...createAPIConfig('provisioning', 'v0alpha1'),
    ...createAPIConfig('shorturl', 'v1beta1'),
    ...createAPIConfig('notifications.alerting', 'v0alpha1'),
    ...createAPIConfig('notifications.alerting', 'v1beta1'),
    ...createAPIConfig('rules.alerting', 'v0alpha1'),
    ...createAPIConfig('historian.alerting', 'v0alpha1'),
    ...createAPIConfig('logsdrilldown', 'v1beta1'),
    ...createAPIConfig('logsdrilldown', 'v1alpha1'),
    ...createAPIConfig('quotas', 'v0alpha1'),
    ...createAPIConfig('plugins', 'v0alpha1'),
    ...createAPIConfig('preferences', 'v1'),
    ...createAPIConfig('rules.alerting', 'v1beta1'),
    // GENERATED:API_CLIENT — used by the API client generator
  },
};

export default config;
