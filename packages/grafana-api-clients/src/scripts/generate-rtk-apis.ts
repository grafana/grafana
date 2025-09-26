// Generates Redux Toolkit API slices for certain APIs from the OpenAPI spec
import type { ConfigFile } from '@rtk-query/codegen-openapi';

const config: ConfigFile = {
  schemaFile: '', // leave this empty, and instead populate the outputFiles object below
  apiFile: '', // leave this empty, and instead populate the outputFiles object below
  exportName: 'generatedAPI',

  outputFiles: {
    '../clients/migrate-to-cloud/endpoints.gen.ts': {
      schemaFile: '../../../public/openapi3.json',
      apiFile: '../clients/migrate-to-cloud/baseAPI.ts',
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
    '../clients/preferences/user/endpoints.gen.ts': {
      schemaFile: '../../../public/openapi3.json',
      hooks: true,
      apiFile: '../clients/preferences/user/baseAPI.ts',
      apiImport: 'baseAPI',
      filterEndpoints: ['getUserPreferences', 'updateUserPreferences', 'patchUserPreferences'],
    },
    '../clients/iam/v0alpha1/endpoints.gen.ts': {
      schemaFile: '../../../data/openapi/iam.grafana.app-v0alpha1.json',
      apiFile: '../clients/iam/v0alpha1/baseAPI.ts',
      filterEndpoints: ['getDisplayMapping'],
      tag: true,
    },
    '../clients/provisioning/v0alpha1/endpoints.gen.ts': {
      apiFile: '../clients/provisioning/v0alpha1/baseAPI.ts',
      schemaFile: '../../../data/openapi/provisioning.grafana.app-v0alpha1.json',
      filterEndpoints,
      tag: true,
      hooks: true,
    },
    '../clients/folder/v1beta1/endpoints.gen.ts': {
      apiFile: '../clients/folder/v1beta1/baseAPI.ts',
      schemaFile: '../../../data/openapi/folder.grafana.app-v1beta1.json',
      tag: true,
    },
    '../clients/advisor/v0alpha1/endpoints.gen.ts': {
      apiFile: '../clients/advisor/v0alpha1/baseAPI.ts',
      schemaFile: '../../../data/openapi/advisor.grafana.app-v0alpha1.json',
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
      schemaFile: '../../../data/openapi/playlist.grafana.app-v0alpha1.json',
      filterEndpoints: ['listPlaylist', 'getPlaylist', 'createPlaylist', 'deletePlaylist', 'replacePlaylist'],
      tag: true,
    },
    '../clients/dashboard/v0alpha1/endpoints.gen.ts': {
      apiFile: '../clients/dashboard/v0alpha1/baseAPI.ts',
      schemaFile: '../../../data/openapi/dashboard.grafana.app-v0alpha1.json',
      filterEndpoints: [
        // Do not use any other endpoints from this version
        // If other endpoints are required, they must be used from a newer version of the dashboard API
        'getSearch',
      ],
      tag: true,
    },

    '../clients/shorturl/v1alpha1/endpoints.gen.ts': {
      apiFile: '../clients/shorturl/v1alpha1/baseAPI.ts',
      schemaFile: '../../../data/openapi/shorturl.grafana.app-v1alpha1.json',
      tag: true,
    },
    '../clients/rules/v0alpha1/endpoints.gen.ts': {
      apiFile: '../clients/rules/v0alpha1/baseAPI.ts',
      schemaFile: '../../../data/openapi/rules.alerting.grafana.app-v0alpha1.json',
      tag: true,
    },
    '../clients/preferences/v1alpha1/endpoints.gen.ts': {
      apiFile: '../clients/preferences/v1alpha1/baseAPI.ts',
      schemaFile: '../../../data/openapi/preferences.grafana.app-v1alpha1.json',
      tag: true,
      hooks: true,
    },
    // PLOP_INJECT_API_CLIENT - Used by the API client generator
  },
};

function filterEndpoints(name: string) {
  return !name.toLowerCase().includes('getapiresources') && !name.toLowerCase().includes('update');
}

export default config;
