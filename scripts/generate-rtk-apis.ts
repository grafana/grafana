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
    '../public/app/api/clients/iam/v0alpha1/endpoints.gen.ts': {
      schemaFile: '../data/openapi/iam.grafana.app-v0alpha1.json',
      apiFile: '../public/app/api/clients/iam/v0alpha1/baseAPI.ts',
      filterEndpoints: ['getDisplayMapping'],
      tag: true,
    },
    '../public/app/api/clients/provisioning/v0alpha1/endpoints.gen.ts': {
      apiFile: '../public/app/api/clients/provisioning/v0alpha1/baseAPI.ts',
      schemaFile: '../data/openapi/provisioning.grafana.app-v0alpha1.json',
      filterEndpoints,
      tag: true,
      hooks: true,
    },
    '../public/app/api/clients/folder/v1beta1/endpoints.gen.ts': {
      apiFile: '../public/app/api/clients/folder/v1beta1/baseAPI.ts',
      schemaFile: '../data/openapi/folder.grafana.app-v1beta1.json',
      tag: true,
    },
    '../public/app/api/clients/advisor/v0alpha1/endpoints.gen.ts': {
      apiFile: '../public/app/api/clients/advisor/v0alpha1/baseAPI.ts',
      schemaFile: '../data/openapi/advisor.grafana.app-v0alpha1.json',
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
    '../public/app/api/clients/playlist/v0alpha1/endpoints.gen.ts': {
      apiFile: '../public/app/api/clients/playlist/v0alpha1/baseAPI.ts',
      schemaFile: '../data/openapi/playlist.grafana.app-v0alpha1.json',
      filterEndpoints: ['listPlaylist', 'getPlaylist', 'createPlaylist', 'deletePlaylist', 'replacePlaylist'],
      tag: true,
    },
    '../public/app/api/clients/dashboard/v0alpha1/endpoints.gen.ts': {
      apiFile: '../public/app/api/clients/dashboard/v0alpha1/baseAPI.ts',
      schemaFile: '../data/openapi/dashboard.grafana.app-v0alpha1.json',
      filterEndpoints: [
        // Do not use any other endpoints from this version
        // If other endpoints are required, they must be used from a newer version of the dashboard API
        'getSearch',
      ],
      tag: true,
    },

    // PLOP_INJECT_API_CLIENT - Used by the API client generator
  },
};

function filterEndpoints(name: string) {
  return !name.toLowerCase().includes('getapiresources') && !name.toLowerCase().includes('update');
}

export default config;
