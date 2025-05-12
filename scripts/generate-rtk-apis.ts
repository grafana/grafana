// Generates Redux Toolkit API slices for certain APIs from the OpenAPI spec
import type { ConfigFile } from '@rtk-query/codegen-openapi';

const config: ConfigFile = {
  schemaFile: '', // leave this empty, and instead populate the outputFiles object below
  apiFile: '', // leave this empty, and instead populate the outputFiles object below
  exportName: 'generatedAPI',

  outputFiles: {
    '../public/app/features/migrate-to-cloud/api/endpoints.gen.ts': {
      schemaFile: '../public/openapi3.json',
      apiFile: '../public/app/features/migrate-to-cloud/api/baseAPI.ts',
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
    '../public/app/features/preferences/api/user/endpoints.gen.ts': {
      schemaFile: '../public/openapi3.json',
      hooks: true,
      apiFile: '../public/app/features/preferences/api/user/baseAPI.ts',
      apiImport: 'baseAPI',
      filterEndpoints: ['getUserPreferences', 'updateUserPreferences', 'patchUserPreferences'],
    },
    '../public/app/api/clients/iam/endpoints.gen.ts': {
      schemaFile: '../data/openapi/iam.grafana.app-v0alpha1.json',
      apiFile: '../public/app/api/clients/iam/baseAPI.ts',
      filterEndpoints: ['getDisplayMapping'],
      tag: true,
    },
    '../public/app/api/clients/provisioning/endpoints.gen.ts': {
      apiFile: '../public/app/api/clients/provisioning/baseAPI.ts',
      schemaFile: '../data/openapi/provisioning.grafana.app-v0alpha1.json',
      filterEndpoints,
      tag: true,
      hooks: true,
    },
    '../public/app/api/clients/folder/endpoints.gen.ts': {
      apiFile: '../public/app/api/clients/folder/baseAPI.ts',
      schemaFile: '../data/openapi/folder.grafana.app-v1beta1.json',
      filterEndpoints: ['getFolder'],
      tag: true,
    },
    '../public/app/api/clients/advisor/endpoints.gen.ts': {
      apiFile: '../public/app/api/clients/advisor/baseAPI.ts',
      schemaFile: '../data/openapi/advisor.grafana.app-v0alpha1.json',
      filterEndpoints: ['createCheck', 'getCheck', 'listCheck', 'deleteCheck', 'updateCheck', 'listCheckType'],
      tag: true,
    },
    '../public/app/api/clients/playlist/endpoints.gen.ts': {
      apiFile: '../public/app/api/clients/playlist/baseAPI.ts',
      schemaFile: '../data/openapi/playlist.grafana.app-v0alpha1.json',
      filterEndpoints: ['listPlaylist', 'getPlaylist', 'createPlaylist', 'deletePlaylist', 'replacePlaylist'],
      tag: true,
    },
    // PLOP_INJECT_API_CLIENT - Used by the API client generator
  },
};

function filterEndpoints(name: string) {
  return !name.toLowerCase().includes('getapiresources') && !name.toLowerCase().includes('update');
}

export default config;
