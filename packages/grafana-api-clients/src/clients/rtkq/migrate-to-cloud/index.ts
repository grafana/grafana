import { BaseQueryFn, EndpointDefinition } from '@reduxjs/toolkit/query';

import { generatedAPI as rawAPI } from './endpoints.gen';

export const generatedAPI = rawAPI.enhanceEndpoints({
  addTagTypes: [
    'cloud-migration-token',
    'cloud-migration-session',
    'cloud-migration-snapshot',
    'cloud-migration-resource-dependencies',
  ],

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

    // Resource dependencies
    getResourceDependencies: {
      providesTags: ['cloud-migration-resource-dependencies'],
    },

    getDashboardByUid: suppressErrorsOnQuery,
    getLibraryElementByUid: suppressErrorsOnQuery,
  },
});

function suppressErrorsOnQuery<
  QueryArg,
  BaseQuery extends BaseQueryFn,
  TagTypes extends string,
  ResultType,
  ReducerPath extends string,
  PageParam,
>(endpoint: EndpointDefinition<QueryArg, BaseQuery, TagTypes, ResultType, ReducerPath, PageParam>) {
  if (!endpoint.query) {
    return;
  }

  // internal type from rtk-query that isn't exported
  type InfiniteQueryCombinedArg<QueryArg, PageParam> = {
    queryArg: QueryArg;
    pageParam: PageParam;
  };

  const originalQuery = endpoint.query;
  endpoint.query = (arg: QueryArg & InfiniteQueryCombinedArg<QueryArg, PageParam>) => {
    const baseQuery = originalQuery(arg);
    baseQuery.showErrorAlert = false;
    return baseQuery;
  };
}

export * from './endpoints.gen';
