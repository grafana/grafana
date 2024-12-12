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
    '../public/app/features/provisioning/api/endpoints.gen.ts': {
      apiFile: '../public/app/features/provisioning/api/baseAPI.ts',
      schemaFile: '../public/app/features/provisioning/api/spec.json',
      apiImport: 'baseAPI',
      filterEndpoints,
    },
  },
};

function filterEndpoints(name: string) {
  return (
    !name.toLowerCase().includes('forallnamespaces') &&
    !name.toLowerCase().includes('getapiresources') &&
    !name.toLowerCase().includes('watch')
  );
}

export default config;
