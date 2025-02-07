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
      ],
    },
    '../public/app/features/preferences/api/user/endpoints.gen.ts': {
      schemaFile: '../public/openapi3.json',
      hooks: true,
      apiFile: '../public/app/features/preferences/api/user/baseAPI.ts',
      apiImport: 'baseAPI',
      filterEndpoints: ['getUserPreferences', 'updateUserPreferences', 'patchUserPreferences'],
    },
    '../public/app/features/iam/api/endpoints.gen.ts': {
      schemaFile: '../data/openapi/iam.grafana.app-v0alpha1.json',
      apiFile: '../public/app/features/iam/api/api.ts',
      apiImport: 'iamApi',
      filterEndpoints: ['getDisplayMapping'],
      exportName: 'generatedIamApi',
      flattenArg: false,
      tag: true,
    },
    '../public/app/features/query-library/api/endpoints.gen.ts': {
      schemaFile: '../data/openapi/peakq.grafana.app-v0alpha1.json',
      apiFile: '../public/app/features/query-library/api/api.ts',
      apiImport: 'queryLibraryApi',
      filterEndpoints: ['listQueryTemplate', 'createQueryTemplate', 'deleteQueryTemplate', 'updateQueryTemplate'],
      exportName: 'generatedQueryLibraryApi',
      flattenArg: false,
      tag: true,
    },
    '../public/app/features/provisioning/api/endpoints.gen.ts': {
      apiFile: '../public/app/features/provisioning/api/baseAPI.ts',
      schemaFile: '../data/openapi/provisioning.grafana.app-v0alpha1.json',
      apiImport: 'baseAPI',
      filterEndpoints,
      argSuffix: 'Arg',
      responseSuffix: 'Response',
      tag: true,
      hooks: true,
    },
  },
};

function filterEndpoints(name: string) {
  return (
    !name.toLowerCase().includes('forallnamespaces') &&
    !name.toLowerCase().includes('getapiresources') &&
    !name.toLowerCase().includes('watch') &&
    !name.toLowerCase().includes('collection') &&
    !name.toLowerCase().includes('update')
  );
}

export default config;
