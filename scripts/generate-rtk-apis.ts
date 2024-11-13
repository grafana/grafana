// Generates Redux Toolkit API slices for certain APIs from the OpenAPI spec
import type { ConfigFile } from '@rtk-query/codegen-openapi';

const config: ConfigFile = {
  schemaFile: 'http://localhost:3000/swagger?api=gituisync.grafana.app-v0alpha1',
  apiFile: '', // leave this empty, and instead populate the outputFiles object below
  hooks: true,
  exportName: 'generatedAPI',

  outputFiles: {
    '../public/app/features/migrate-to-cloud/api/endpoints.gen.ts': {
      apiFile: '../public/app/features/migrate-to-cloud/api/baseAPI.ts',
      apiImport: 'baseAPI',
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
      ],
    },
    '../public/app/features/preferences/api/user/endpoints.gen.ts': {
      apiFile: '../public/app/features/preferences/api/user/baseAPI.ts',
      apiImport: 'baseAPI',
      filterEndpoints: ['getUserPreferences', 'updateUserPreferences', 'patchUserPreferences'],
    },
    '../public/app/features/git-sync/api/endpoints.gen.ts': {
      apiFile: '../public/app/features/git-sync/api/baseApi.ts',
      apiImport: 'baseAPI',
    },
  },
};

export default config;
