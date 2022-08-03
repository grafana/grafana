import { BaseQueryFn, createApi } from '@reduxjs/toolkit/query/react';
import { lastValueFrom } from 'rxjs';

import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime';

import { PromBuildInfoResponse } from '../../../../types/unified-alerting-dto';

import { discoverFeatures } from './buildInfo';

const backendSrvBaseQuery = (): BaseQueryFn<BackendSrvRequest> => async (requestOptions) => {
  try {
    const response = await lastValueFrom(getBackendSrv().fetch<PromBuildInfoResponse>(requestOptions));

    return { data: response.data };
  } catch (error) {
    return {
      error: {
        data: error,
      },
    };
  }
};

export const alertingApi = createApi({
  reducerPath: 'alertingApi',
  baseQuery: backendSrvBaseQuery(),
  endpoints: (build) => ({
    discoverAmFeatures: build.query({
      queryFn: async ({ dataSourceName }: { dataSourceName: string }) => {
        try {
          const result = await discoverFeatures(dataSourceName);
          return { data: result };
        } catch (error) {
          return { error: error };
        }
      },
    }),
  }),
});

const { useDiscoverAmFeaturesQuery } = alertingApi;
const { discoverAmFeatures } = alertingApi.endpoints;

export const featureDiscoveryApi = {
  discoverAmFeatures,
  useDiscoverAmFeaturesQuery,
};
