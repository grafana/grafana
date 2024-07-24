export * from './endpoints.gen';
import { BaseQueryFn, EndpointDefinition } from '@reduxjs/toolkit/dist/query';

import { generatedAPI } from './endpoints.gen';

export const cloudMigrationAPI = generatedAPI.enhanceEndpoints({
  addTagTypes: ['cloud-migration-token', 'cloud-migration-session', 'cloud-migration-snapshot'],

  endpoints: {
    // Cloud-side - create token
    getCloudMigrationToken(endpoint) {
      suppressErrorsOnQuery(endpoint);
      endpoint.providesTags = ['cloud-migration-token'];
    },
    createCloudMigrationToken(endpoint) {
      suppressErrorsOnQuery(endpoint);
      endpoint.invalidatesTags = ['cloud-migration-token'];
    },
    deleteCloudMigrationToken(endpoint) {
      suppressErrorsOnQuery(endpoint);
      endpoint.invalidatesTags = ['cloud-migration-token'];
    },

    // List Cloud Configs
    getSessionList: {
      providesTags: ['cloud-migration-session'] /* should this be a -list? */,
    },

    // Create Cloud Config
    createSession(endpoint) {
      suppressErrorsOnQuery(endpoint);
      endpoint.invalidatesTags = ['cloud-migration-session'];
    },

    // Get one Cloud Config
    getSession: {
      providesTags: ['cloud-migration-session'],
    },

    // Delete one Cloud Config
    deleteSession: {
      invalidatesTags: ['cloud-migration-session', 'cloud-migration-snapshot'],
    },

    // Snapshot management
    getSnapshot: {
      providesTags: ['cloud-migration-snapshot'],
    },
    getShapshotList: {
      providesTags: ['cloud-migration-snapshot'],
    },
    createSnapshot: {
      invalidatesTags: ['cloud-migration-snapshot'],
    },
    uploadSnapshot: {
      invalidatesTags: ['cloud-migration-snapshot'],
    },

    getDashboardByUid: suppressErrorsOnQuery,
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
