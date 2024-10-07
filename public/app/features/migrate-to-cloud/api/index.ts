export * from './endpoints.gen';
import { BaseQueryFn, EndpointDefinition } from '@reduxjs/toolkit/dist/query';

import { generatedAPI } from './endpoints.gen';

export const cloudMigrationAPI = generatedAPI.enhanceEndpoints({
  addTagTypes: ['cloud-migration-token', 'cloud-migration-session', 'cloud-migration-snapshot'],

  endpoints: {
    // Cloud-side - create token
    getCloudMigrationToken: {
      providesTags: ['cloud-migration-token'],
    },
    createCloudMigrationToken: {
      invalidatesTags: ['cloud-migration-token'],
    },
    deleteCloudMigrationToken: {
      invalidatesTags: ['cloud-migration-token'],
    },

    // On-prem session management (entering token)
    getSessionList: {
      providesTags: ['cloud-migration-session'] /* should this be a -list? */,
    },
    getSession: {
      providesTags: ['cloud-migration-session'],
    },
    createSession: {
      invalidatesTags: ['cloud-migration-session'],
    },
    deleteSession: {
      invalidatesTags: ['cloud-migration-session', 'cloud-migration-snapshot'],
    },

    // Snapshot management
    getShapshotList: {
      providesTags: ['cloud-migration-snapshot'],
    },
    getSnapshot: {
      providesTags: ['cloud-migration-snapshot'],
    },
    createSnapshot: {
      invalidatesTags: ['cloud-migration-snapshot'],
    },
    uploadSnapshot: {
      invalidatesTags: ['cloud-migration-snapshot'],
    },

    getDashboardByUid: suppressErrorsOnQuery,
    getLibraryElementByUid: suppressErrorsOnQuery,
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
