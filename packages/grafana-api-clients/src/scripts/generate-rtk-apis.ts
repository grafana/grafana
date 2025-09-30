// Generates Redux Toolkit API slices for certain APIs from the OpenAPI spec
import type { ConfigFile } from '@rtk-query/codegen-openapi';
import path from 'path';

// Grafana root path - navigate up from this script's directory
const basePath = path.resolve(__dirname, '../../../..');

const getAPIConfig = (
  app: string,
  version: string,
  filterEndpoints?: ConfigFile['filterEndpoints'],
  additional = {}
) => {
  const filePath = `../clients/${app}/${version}/endpoints.gen.ts`;
  return {
    [filePath]: {
      schemaFile: path.join(basePath, `data/openapi/${app}.grafana.app-${version}.json`),
      apiFile: `../clients/${app}/${version}/baseAPI.ts`,
      filterEndpoints,
      tag: true,
      ...additional,
    },
  };
};

const config: ConfigFile = {
  schemaFile: '', // leave this empty, and instead populate the outputFiles object below
  apiFile: '', // leave this empty, and instead populate the outputFiles object below
  exportName: 'generatedAPI',

  outputFiles: {
    '../clients/migrate-to-cloud/endpoints.gen.ts': {
      schemaFile: path.join(basePath, 'public/openapi3.json'),
      apiFile: '../clients/migrate-to-cloud/baseAPI.ts',
      hooks: true,
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
    '../clients/preferences/user/endpoints.gen.ts': {
      schemaFile: path.join(basePath, 'public/openapi3.json'),
      hooks: true,
      apiFile: '../clients/preferences/user/baseAPI.ts',
      filterEndpoints: ['getUserPreferences', 'updateUserPreferences', 'patchUserPreferences'],
    },
    ...getAPIConfig('iam', 'v0alpha1', ['getDisplayMapping']),
    ...getAPIConfig('provisioning', 'v0alpha1', filterEndpoints),
    ...getAPIConfig('folder', 'v1beta1', undefined),
    ...getAPIConfig('advisor', 'v0alpha1', [
      'createCheck',
      'getCheck',
      'listCheck',
      'deleteCheck',
      'updateCheck',
      'listCheckType',
      'updateCheckType',
    ]),
    ...getAPIConfig('playlist', 'v0alpha1', [
      'listPlaylist',
      'getPlaylist',
      'createPlaylist',
      'deletePlaylist',
      'replacePlaylist',
    ]),

    ...getAPIConfig('shorturl', 'v1alpha1'),
    ...getAPIConfig('rules', 'v0alpha1'),
    ...getAPIConfig('preferences', 'v1alpha1'),
    ...getAPIConfig('dashboard', 'v0alpha1', ['getSearch']),
    ...getAPIConfig(foo, 'v0alpha1', []),
    // PLOP_INJECT_API_CLIENT - Used by the API client generator
  },
};

function filterEndpoints(name: string) {
  return !name.toLowerCase().includes('getapiresources') && !name.toLowerCase().includes('update');
}

export default config;
