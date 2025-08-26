import { BaseQueryFn, EndpointDefinition } from '@reduxjs/toolkit/query';

import { getLocalPlugins } from 'app/features/plugins/admin/api';
import { LocalPlugin } from 'app/features/plugins/admin/types';

import { handleRequestError } from '../../../api/createBaseQuery';

import { generatedAPI } from './endpoints.gen';

export * from './endpoints.gen';

export const cloudMigrationAPI = generatedAPI
  .injectEndpoints({
    endpoints: (build) => ({
      // Manually written because the Swagger specifications for the plugins endpoint do not exist
      getLocalPluginList: build.query<LocalPlugin[], void>({
        queryFn: async () => {
          try {
            const list = await getLocalPlugins();
            return { data: list };
          } catch (error) {
            return handleRequestError(error);
          }
        },
      }),
    }),
  })
  .enhanceEndpoints({
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
      getLocalPluginList: suppressErrorsOnQuery,
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

export const { useGetLocalPluginListQuery } = cloudMigrationAPI;
