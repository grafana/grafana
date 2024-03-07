import { BaseQueryFn, createApi } from '@reduxjs/toolkit/query/react';
import { lastValueFrom } from 'rxjs';

import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime';

import { logMeasurement } from '../Analytics';

export const backendSrvBaseQuery = (): BaseQueryFn<BackendSrvRequest> => async (requestOptions) => {
  try {
    const requestStartTs = performance.now();

    const { data, ...meta } = await lastValueFrom(getBackendSrv().fetch(requestOptions));

    logMeasurement(
      'backendSrvBaseQuery',
      {
        loadTimeMs: performance.now() - requestStartTs,
      },
      {
        url: requestOptions.url,
        method: requestOptions.method ?? 'GET',
        responseStatus: meta.statusText,
      }
    );

    return { data, meta };
  } catch (error) {
    return { error };
  }
};

export const alertingApi = createApi({
  reducerPath: 'alertingApi',
  baseQuery: backendSrvBaseQuery(),
  tagTypes: [
    'AlertmanagerChoice',
    'AlertmanagerConfiguration',
    'OnCallIntegrations',
    'OrgMigrationState',
    'DataSourceSettings',
  ],
  endpoints: () => ({}),
});
