import { BaseQueryFn, createApi } from '@reduxjs/toolkit/query/react';
import { lastValueFrom } from 'rxjs';

import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime';

interface RequestOptions extends BackendSrvRequest {
  manageError?: (err: unknown) => { error: unknown };
  showErrorAlert?: boolean;
}

function createBackendSrvBaseQuery({ baseURL }: { baseURL: string }): BaseQueryFn<RequestOptions> {
  async function backendSrvBaseQuery(requestOptions: RequestOptions) {
    try {
      const { data: responseData, ...meta } = await lastValueFrom(
        getBackendSrv().fetch({
          ...requestOptions,
          url: baseURL + requestOptions.url,
          showErrorAlert: requestOptions.showErrorAlert,
        })
      );
      return { data: responseData, meta };
    } catch (error) {
      return requestOptions.manageError ? requestOptions.manageError(error) : { error };
    }
  }

  return backendSrvBaseQuery;
}

interface MigrateToCloudStatusDTO {
  enabled: boolean;
}

interface CreateMigrationTokenResponseDTO {
  token: string;
}

// TODO remove these mock properties/functions
const MOCK_DELAY_MS = 1000;
const MOCK_TOKEN = 'TODO_thisWillBeABigLongToken';
let HAS_MIGRATION_TOKEN = false;

export const migrateToCloudAPI = createApi({
  tagTypes: ['migrationToken'],
  reducerPath: 'migrateToCloudAPI',
  baseQuery: createBackendSrvBaseQuery({ baseURL: '/api' }),
  endpoints: (builder) => ({
    // TODO :)
    getStatus: builder.query<MigrateToCloudStatusDTO, void>({
      queryFn: () => ({ data: { enabled: false } }),
    }),
    createMigrationToken: builder.mutation<CreateMigrationTokenResponseDTO, void>({
      invalidatesTags: ['migrationToken'],
      queryFn: async () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            HAS_MIGRATION_TOKEN = true;
            resolve({ data: { token: MOCK_TOKEN } });
          }, MOCK_DELAY_MS);
        });
      },
    }),
    deleteMigrationToken: builder.mutation<void, void>({
      invalidatesTags: ['migrationToken'],
      queryFn: async () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            HAS_MIGRATION_TOKEN = false;
            resolve({ data: undefined });
          }, MOCK_DELAY_MS);
        });
      },
    }),
    hasMigrationToken: builder.query<boolean, void>({
      providesTags: ['migrationToken'],
      queryFn: async () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({ data: HAS_MIGRATION_TOKEN });
          }, MOCK_DELAY_MS);
        });
      },
    }),
  }),
});

export const {
  useGetStatusQuery,
  useCreateMigrationTokenMutation,
  useDeleteMigrationTokenMutation,
  useHasMigrationTokenQuery,
} = migrateToCloudAPI;
