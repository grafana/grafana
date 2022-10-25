import { BaseQueryFn, createApi } from '@reduxjs/toolkit/query/react';
import { lastValueFrom } from 'rxjs';

import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime';

import { logInfo } from '../Analytics';

const backendSrvBaseQuery = (): BaseQueryFn<BackendSrvRequest> => async (requestOptions) => {
  try {
    const requestStartTs = performance.now();

    const { data, ...meta } = await lastValueFrom(getBackendSrv().fetch(requestOptions));

    logInfo('Request finished', {
      loadTimeMs: (performance.now() - requestStartTs).toFixed(0),
      url: requestOptions.url,
      method: requestOptions.method ?? '',
      responseStatus: meta.statusText,
    });

    return { data, meta };
  } catch (error) {
    return { error };
  }
};

export const alertingApi = createApi({
  reducerPath: 'alertingApi',
  baseQuery: backendSrvBaseQuery(),
  tagTypes: ['AlertmanagerChoice'],
  endpoints: () => ({}),
});
