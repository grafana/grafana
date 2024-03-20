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

export interface MigrationResourceDTO {
  uid: string;
  status: 'not-migrated' | 'migrated' | 'migrating' | 'failed';
  statusMessage?: string;
  type: 'datasource' | 'dashboard'; // TODO: in future this would be a discriminated union with the resource details
  resource: {
    uid: string;
    name: string;
    type: string;
    icon?: string;
  };
}

const mockApplications = ['auth-service', 'web server', 'backend'];
const mockEnvs = ['DEV', 'PROD'];
const mockRoles = ['db', 'load-balancer', 'server', 'logs'];
const mockDataSources = ['Prometheus', 'Loki', 'AWS Athena', 'AWS Cloudwatch', 'InfluxDB', 'Elasticsearch'];

const mockDataSourceMetadata: Record<string, { image: string }> = {
  Prometheus: {
    image: 'https://grafana.com/api/plugins/prometheus/versions/5.0.0/logos/small',
  },

  Loki: {
    image: 'https://grafana.com/api/plugins/loki/versions/5.0.0/logos/small',
  },

  'AWS Athena': {
    image: 'https://grafana.com/api/plugins/grafana-athena-datasource/versions/2.13.5/logos/small',
  },

  'AWS Cloudwatch': {
    image: 'https://grafana.com/api/plugins/computest-cloudwatchalarm-datasource/versions/2.0.0/logos/small',
  },

  InfluxDB: {
    image: 'https://grafana.com/api/plugins/influxdb/versions/5.0.0/logos/small',
  },

  Elasticsearch: {
    image: 'https://grafana.com/api/plugins/elasticsearch/versions/5.0.0/logos/small',
  },
};

const mockMigrationResources: MigrationResourceDTO[] = Array.from({ length: 500 }).map((_, index) => {
  const dataSource = mockDataSources[index % mockDataSources.length];
  const environment = mockEnvs[index % mockEnvs.length];
  const application = mockApplications[index % mockApplications.length];
  const role = mockRoles[index % mockRoles.length];

  return {
    status: 'not-migrated',
    type: 'datasource',
    uid: index.toString(16),
    resource: {
      uid: `${application}-${environment}-${role}-${index}`,
      name: `${application} ${environment} ${role}`,
      icon: mockDataSourceMetadata[dataSource]?.image,
      type: dataSource,
    },
  };
});

mockMigrationResources[0].status = 'migrated';
mockMigrationResources[1].status = 'failed';
mockMigrationResources[1].statusMessage = `Source map error: Error: request failed with status 404
Resource URL: http://localhost:3000/public/build/app.f4d0c6a0daa6a5b14892.js
Source Map URL: app.f4d0c6a0daa6a5b14892.js.map`;
mockMigrationResources[2].status = 'migrated';
mockMigrationResources[3].status = 'migrated';
mockMigrationResources[4].status = 'migrating';
mockMigrationResources[5].status = 'migrating';

// TODO remove these mock properties/functions
const queryParams = new URLSearchParams(window.location.search);
const MOCK_DELAY_MS = 1000;
const MOCK_TOKEN = 'TODO_thisWillBeABigLongToken';
let HAS_MIGRATION_TOKEN = false;
let HAS_STACK_DETAILS = !!queryParams.get('mockStackURL');
let STACK_URL: string | undefined = queryParams.get('mockStackURL') || undefined;

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
        return dataWithMockDelay(mockMigrationResources);
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
