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
        'getMigrationList',
        'getCloudMigration',
        'createMigration',
        'runCloudMigration',
        'getCloudMigrationRun',
        'getCloudMigrationRunList',
        'deleteCloudMigration',
        'getDashboardByUid',
      ],
    },

    '../public/app/features/playlist/endpoints.gen.ts': {
      schemaFile: '../pkg/tests/apis/playlist/testdata/openapi.json',
      apiFile: '../public/app/features/playlist/baseAPI.ts',
      apiImport: 'baseAPI',
    },

    // '../public/app/features/playlist/endpoints-filtered.gen.ts': {
    //   schemaFile: '../pkg/tests/apis/playlist/testdata/openapi.json',
    //   apiFile: '../public/app/features/playlist/baseAPI.ts',
    //   apiImport: 'baseAPI',
    //   filterEndpoints: [],
    // },

    '../public/app/features/playlist/scopes-endpoints.gen.ts': {
      schemaFile: '../pkg/tests/apis/scopes/testdata/openapi.json',
      apiFile: '../public/app/features/playlist/baseAPI.ts',
      apiImport: 'baseAPI',
    },
  },
};

export default config;
