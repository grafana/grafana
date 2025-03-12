import { BaseQueryFn, EndpointDefinition } from '@reduxjs/toolkit/query';

import { getLocalPlugins } from 'app/features/plugins/admin/api';
import { LocalPlugin } from 'app/features/plugins/admin/types';

import { handleRequestError } from '../../../api/createBaseQuery';

import { generatedAPI } from './endpoints.gen';
import { transformError } from './errors';

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
    addTagTypes: ['cloud-migration-token', 'cloud-migration-session', 'cloud-migration-snapshot'],

    endpoints: {
      // Cloud-side - create token
      getCloudMigrationToken: {
        transformErrorResponse: transformError,
        providesTags: ['cloud-migration-token'],
      },
      createCloudMigrationToken: {
        transformErrorResponse: transformError,
        invalidatesTags: ['cloud-migration-token'],
      },
      deleteCloudMigrationToken: {
        transformErrorResponse: transformError,
        invalidatesTags: ['cloud-migration-token'],
      },

      // On-prem session management (entering token)
      getSessionList: {
        transformErrorResponse: transformError,
        providesTags: ['cloud-migration-session'] /* should this be a -list? */,
      },
      getSession: {
        transformErrorResponse: transformError,
        providesTags: ['cloud-migration-session'],
      },
      createSession: {
        transformErrorResponse: transformError,
        invalidatesTags: ['cloud-migration-session'],
      },
      deleteSession: {
        transformErrorResponse: transformError,
        invalidatesTags: ['cloud-migration-session', 'cloud-migration-snapshot'],
      },

      // Snapshot management
      getShapshotList: {
        transformErrorResponse: transformError,
        providesTags: ['cloud-migration-snapshot'],
      },
      getSnapshot: {
        transformErrorResponse: transformError,
        providesTags: ['cloud-migration-snapshot'],
      },
      createSnapshot: {
        transformErrorResponse: transformError,
        invalidatesTags: ['cloud-migration-snapshot'],
      },
      uploadSnapshot: {
        transformErrorResponse: transformError,
        invalidatesTags: ['cloud-migration-snapshot'],
      },

      getDashboardByUid: suppressErrorsOnQuery,
      getLibraryElementByUid: suppressErrorsOnQuery,
      getLocalPluginList: suppressErrorsOnQuery,
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

export const { useGetLocalPluginListQuery } = cloudMigrationAPI;
