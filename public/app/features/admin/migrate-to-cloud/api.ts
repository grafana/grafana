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
  stackURL?: string;
}

interface CreateMigrationTokenResponseDTO {
  token: string;
}

interface ConnectStackProps {
  stackURL: string;
  token: string;
}

// TODO remove these mock properties/functions
const MOCK_DELAY_MS = 1000;
const MOCK_TOKEN = 'TODO_thisWillBeABigLongToken';
let HAS_MIGRATION_TOKEN = false;
let HAS_STACK_DETAILS = false;
let STACK_URL: string | undefined;

export const migrateToCloudAPI = createApi({
  tagTypes: ['migrationToken', 'stack'],
  reducerPath: 'migrateToCloudAPI',
  baseQuery: createBackendSrvBaseQuery({ baseURL: '/api' }),
  endpoints: (builder) => ({
    // TODO :)
    getStatus: builder.query<MigrateToCloudStatusDTO, void>({
      providesTags: ['stack'],
      queryFn: () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            const responseData: MigrateToCloudStatusDTO = { enabled: HAS_STACK_DETAILS };
            if (STACK_URL) {
              responseData.stackURL = STACK_URL;
            }
            resolve({ data: responseData });
          }, MOCK_DELAY_MS);
        });
      },
    }),
    connectStack: builder.mutation<void, ConnectStackProps>({
      invalidatesTags: ['stack'],
      queryFn: async ({ stackURL }) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            HAS_STACK_DETAILS = true;
            STACK_URL = stackURL;
            resolve({ data: undefined });
          }, MOCK_DELAY_MS);
        });
      },
    }),
    disconnectStack: builder.mutation<void, void>({
      invalidatesTags: ['stack'],
      queryFn: async () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            HAS_STACK_DETAILS = false;
            STACK_URL = undefined;
            resolve({ data: undefined });
          }, MOCK_DELAY_MS);
        });
      },
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
  useConnectStackMutation,
  useDisconnectStackMutation,
  useCreateMigrationTokenMutation,
  useDeleteMigrationTokenMutation,
  useHasMigrationTokenQuery,
} = migrateToCloudAPI;
