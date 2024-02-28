import { BaseQueryFn, createApi } from '@reduxjs/toolkit/query/react';
import { shuffle } from 'lodash';
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

export interface MigrationResourceDTO {
  uid: string;
  status: 'not-migrated' | 'migrated' | 'migrating' | 'failed';
  statusMessage?: string;
  type: 'datasource';
  resource: {
    uid: string;
    name: string;
    type: string;
  };
}

const applications = shuffle(['auth-service', 'web server', 'backend']);
const environments = shuffle(['DEV', 'PROD']);
const roles = shuffle(['db', 'load-balancer', 'server', 'logs']);
const dataSources = shuffle(['Prometheus', 'Loki', 'AWS Athena', 'AWS Cloudwatch', 'InfluxDB', 'Elasticsearch']);

const migrationResources: MigrationResourceDTO[] = Array.from({ length: 500 }).map((_, index) => {
  const dataSource = dataSources[index % dataSources.length];
  const environment = environments[index % environments.length];
  const application = applications[index % applications.length];
  const role = roles[index % roles.length];

  return {
    status: 'not-migrated',
    type: 'datasource',
    uid: index.toString(16),
    resource: {
      uid: `${application}-${environment}-${role}-${index}`,
      name: `${application} ${environment} ${role}`,
      type: dataSource,
    },
  };
});

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
  tagTypes: ['migrationToken', 'stackDetails', 'resource'],
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

    listResources: builder.query<MigrationResourceDTO[], void>({
      providesTags: ['resource'],
      queryFn: async () => {
        return dataWithMockDelay(migrationResources);
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
  useListResourcesQuery,
} = migrateToCloudAPI;
