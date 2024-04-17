export * from './endpoints.gen';
import { BaseQueryFn, EndpointDefinition } from '@reduxjs/toolkit/dist/query';

import { generatedAPI } from './endpoints.gen';

export const cloudMigrationAPI = generatedAPI.enhanceEndpoints({
  addTagTypes: ['cloud-migration-config', 'cloud-migration-run', 'cloud-migration-run-list'],
  endpoints: {
    // List Cloud Configs
    getMigrationList: {
      providesTags: ['cloud-migration-config'] /* should this be a -list? */,
    },

    // Create Cloud Config
    createMigration(endpoint) {
      suppressErrorsOnQuery(endpoint);
      endpoint.invalidatesTags = ['cloud-migration-config'];
    },

    // Get one Cloud Config
    getCloudMigration: {
      providesTags: ['cloud-migration-config'],
    },

    // Delete one Cloud Config
    deleteCloudMigration: {
      invalidatesTags: ['cloud-migration-config'],
    },

    getCloudMigrationRunList: {
      providesTags: ['cloud-migration-run-list'],
    },

    getCloudMigrationRun: {
      providesTags: ['cloud-migration-run'],
    },

    runCloudMigration: {
      invalidatesTags: ['cloud-migration-run-list'],
    },

    getDashboardByUid(endpoint) {
      suppressErrorsOnQuery(endpoint);
    },
  },
});

function suppressErrorsOnQuery<QueryArg, BaseQuery extends BaseQueryFn, TagTypes extends string, ResultType>(
  endpoint: EndpointDefinition<QueryArg, BaseQuery, TagTypes, ResultType>
) {
  if (!endpoint.query) {
    return;
  }

  const originalQuery = endpoint.query;
  endpoint.query = (...args) => {
    const baseQuery = originalQuery(...args);
    baseQuery.showErrorAlert = false;
    return baseQuery;
  };
}
