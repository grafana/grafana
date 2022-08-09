import { BaseQueryFn, createApi } from '@reduxjs/toolkit/query/react';
import { lastValueFrom } from 'rxjs';

import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime';

const backendSrvBaseQuery = (): BaseQueryFn<BackendSrvRequest> => async (requestOptions) => {
  try {
    const { data, url, headers, redirected, status, statusText } = await lastValueFrom(
      getBackendSrv().fetch(requestOptions)
    );

    return { data: data, meta: { url, headers, redirected, status, statusText } };
  } catch (error) {
    return { error: error };
  }
};

export const alertingApi = createApi({
  reducerPath: 'alertingApi',
  baseQuery: backendSrvBaseQuery(),
  endpoints: () => ({}),
});
