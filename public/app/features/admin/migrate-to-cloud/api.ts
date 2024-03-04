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

export interface ConnectStackDTO {
  stackURL: string;
  token: string;
}

// TODO remove these mock properties/functions
const MOCK_DELAY_MS = 1000;
const MOCK_TOKEN = 'TODO_thisWillBeABigLongToken';
let HAS_MIGRATION_TOKEN = false;
let HAS_STACK_DETAILS = false;
let STACK_URL: string | undefined;

function dataWithMockDelay<T>(data: T): Promise<{ data: T }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ data });
    }, MOCK_DELAY_MS);
  });
}

export const migrateToCloudAPI = createApi({
  tagTypes: ['migrationToken', 'stackDetails'],
  reducerPath: 'migrateToCloudAPI',
  baseQuery: createBackendSrvBaseQuery({ baseURL: '/api' }),
  endpoints: (builder) => ({
    // TODO :)
    getStatus: builder.query<MigrateToCloudStatusDTO, void>({
      providesTags: ['stackDetails'],
      queryFn: () => {
        const responseData: MigrateToCloudStatusDTO = { enabled: HAS_STACK_DETAILS };
        if (STACK_URL) {
          responseData.stackURL = STACK_URL;
        }
        return dataWithMockDelay(responseData);
      },
    }),
    connectStack: builder.mutation<void, ConnectStackDTO>({
      invalidatesTags: ['stackDetails'],
      queryFn: async ({ stackURL }) => {
        HAS_STACK_DETAILS = true;
        STACK_URL = stackURL;
        return dataWithMockDelay(undefined);
      },
    }),
    disconnectStack: builder.mutation<void, void>({
      invalidatesTags: ['stackDetails'],
      queryFn: async () => {
        HAS_STACK_DETAILS = false;
        return dataWithMockDelay(undefined);
      },
    }),

    createMigrationToken: builder.mutation<CreateMigrationTokenResponseDTO, void>({
      invalidatesTags: ['migrationToken'],
      queryFn: async () => {
        HAS_MIGRATION_TOKEN = true;
        return dataWithMockDelay({ token: MOCK_TOKEN });
      },
    }),

    deleteMigrationToken: builder.mutation<void, void>({
      invalidatesTags: ['migrationToken'],
      queryFn: async () => {
        HAS_MIGRATION_TOKEN = false;
        return dataWithMockDelay(undefined);
      },
    }),

    hasMigrationToken: builder.query<boolean, void>({
      providesTags: ['migrationToken'],
      queryFn: async () => {
        return dataWithMockDelay(HAS_MIGRATION_TOKEN);
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
