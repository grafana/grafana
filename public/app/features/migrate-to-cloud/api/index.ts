export * from './endpoints.gen';
import { BaseQueryFn, QueryDefinition } from '@reduxjs/toolkit/dist/query';
import { A } from 'msw/lib/core/HttpResponse-vQNlixkj';

import { generatedAPI } from './endpoints.gen';

export const cloudMigrationAPI = generatedAPI.enhanceEndpoints({
  addTagTypes: ['cloud-migration-config', 'cloud-migration-run'],
  endpoints: {
    // List Cloud Configs
    getMigrationList: {
      providesTags: ['cloud-migration-config'] /* should this be a -list? */,
    },

    // Create Cloud Config
    createMigration: {
      invalidatesTags: ['cloud-migration-config'],
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
      providesTags: ['cloud-migration-run'] /* should this be a -list? */,
    },

    getCloudMigrationRun: {
      providesTags: ['cloud-migration-run'],
    },

    runCloudMigration: {
      invalidatesTags: ['cloud-migration-run'],
    },

    getDashboardByUid(endpoint) {
      suppressErrorsOnQuery(endpoint);
    },
  },
});

function suppressErrorsOnQuery<QueryArg, BaseQuery extends BaseQueryFn, TagTypes extends string, ResultType>(
  endpoint: QueryDefinition<QueryArg, BaseQuery, TagTypes, ResultType>
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
