// Generates Redux Toolkit API slices for certain APIs from the OpenAPI spec
import type { ConfigFile } from '@rtk-query/codegen-openapi';

const config: ConfigFile = {
  schemaFile: '../public/openapi3.json',
  apiFile: '', // leave this empty, and instead populate the outputFiles object below
  hooks: true,
  exportName: 'generatedAPI',

  outputFiles: {
    '../public/app/features/migrate-to-cloud/api/endpoints.gen.ts': {
      apiFile: '../public/app/features/migrate-to-cloud/api/baseAPI.ts',
      apiImport: 'baseAPI',
      filterEndpoints: [
        'createCloudMigrationToken',
        'getSessionList',
        'getSession',
        'createSession',
        'deleteSession',
        'runCloudMigration',
        'getCloudMigrationRun',
        'getCloudMigrationRunList',
        'getDashboardByUid',
      ],
    },
    '../public/app/features/preferences/api/endpoints.gen.ts': {
      apiFile: '../public/app/features/preferences/api/baseAPI.ts',
      apiImport: 'baseAPI',
      filterEndpoints: [
        'getUserPreferences',
        'updateUserPreferences',
        'patchUserPreferences',
        'getOrgPreferences',
        'updateOrgPreferences',
        'patchOrgPreferences',
      ],
    },
  },
};

export default config;
