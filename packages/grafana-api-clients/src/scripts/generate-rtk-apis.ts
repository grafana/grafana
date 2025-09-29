// Generates Redux Toolkit API slices for certain APIs from the OpenAPI spec
import type { ConfigFile } from '@rtk-query/codegen-openapi';
import path from 'path';

// Grafana root path - navigate up from this script's directory
const basePath = path.resolve(__dirname, '../../../..');

const config: ConfigFile = {
  schemaFile: '', // leave this empty, and instead populate the outputFiles object below
  apiFile: '', // leave this empty, and instead populate the outputFiles object below
  exportName: 'generatedAPI',

  outputFiles: {
    [path.join(basePath, 'public/app/features/migrate-to-cloud/api/endpoints.gen.ts')]: {
      schemaFile: path.join(basePath, 'public/openapi3.json'),
      apiFile: 'baseAPI',
      // TODO this import doesn't seem to work correctly - ends up as import { baseAPI } from 'baseAPI'
      apiImport: 'baseAPI',
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
    [path.join(basePath, 'public/app/features/preferences/api/user/endpoints.gen.ts')]: {
      schemaFile: path.join(basePath, 'public/openapi3.json'),
      hooks: true,
      apiFile: 'baseAPI',
      // TODO this import doesn't seem to work correctly - ends up as import { baseAPI } from 'baseAPI'
      apiImport: 'baseAPI',
      filterEndpoints: ['getUserPreferences', 'updateUserPreferences', 'patchUserPreferences'],
    },
    '../clients/iam/v0alpha1/endpoints.gen.ts': {
      schemaFile: path.join(basePath, 'data/openapi/iam.grafana.app-v0alpha1.json'),
      apiFile: '../clients/iam/v0alpha1/baseAPI.ts',
      filterEndpoints: ['getDisplayMapping'],
      tag: true,
    },
    '../clients/provisioning/v0alpha1/endpoints.gen.ts': {
      apiFile: '../clients/provisioning/v0alpha1/baseAPI.ts',
      schemaFile: path.join(basePath, 'data/openapi/provisioning.grafana.app-v0alpha1.json'),
      filterEndpoints,
      tag: true,
      hooks: true,
    },
    '../clients/folder/v1beta1/endpoints.gen.ts': {
      apiFile: '../clients/folder/v1beta1/baseAPI.ts',
      schemaFile: path.join(basePath, 'data/openapi/folder.grafana.app-v1beta1.json'),
      tag: true,
    },
    '../clients/advisor/v0alpha1/endpoints.gen.ts': {
      apiFile: '../clients/advisor/v0alpha1/baseAPI.ts',
      schemaFile: path.join(basePath, 'data/openapi/advisor.grafana.app-v0alpha1.json'),
      filterEndpoints: [
        'createCheck',
        'getCheck',
        'listCheck',
        'deleteCheck',
        'updateCheck',
        'listCheckType',
        'updateCheckType',
      ],
      tag: true,
    },
    '../clients/playlist/v0alpha1/endpoints.gen.ts': {
      apiFile: '../clients/playlist/v0alpha1/baseAPI.ts',
      schemaFile: path.join(basePath, 'data/openapi/playlist.grafana.app-v0alpha1.json'),
      filterEndpoints: ['listPlaylist', 'getPlaylist', 'createPlaylist', 'deletePlaylist', 'replacePlaylist'],
      tag: true,
    },
    '../clients/shorturl/v1alpha1/endpoints.gen.ts': {
      apiFile: '../clients/shorturl/v1alpha1/baseAPI.ts',
      schemaFile: path.join(basePath, 'data/openapi/shorturl.grafana.app-v1alpha1.json'),
      tag: true,
    },
    '../clients/rules/v0alpha1/endpoints.gen.ts': {
      apiFile: '../clients/rules/v0alpha1/baseAPI.ts',
      schemaFile: path.join(basePath, 'data/openapi/rules.alerting.grafana.app-v0alpha1.json'),
      tag: true,
    },
    '../clients/preferences/v1alpha1/endpoints.gen.ts': {
      apiFile: '../clients/preferences/v1alpha1/baseAPI.ts',
      schemaFile: path.join(basePath, 'data/openapi/preferences.grafana.app-v1alpha1.json'),
      tag: true,
      hooks: true,
    },
    '../clients/dashboard/v0alpha1/endpoints.gen.ts': {
      apiFile: '../clients/dashboard/v0alpha1/baseAPI.ts',
      schemaFile: path.join(basePath, 'data/openapi/dashboard.grafana.app-v0alpha1.json'),
      filterEndpoints: ['getSearch'],
      tag: true,
    },
    // PLOP_INJECT_API_CLIENT - Used by the API client generator
  },
};

function filterEndpoints(name: string) {
  return !name.toLowerCase().includes('getapiresources') && !name.toLowerCase().includes('update');
}

export default config;
