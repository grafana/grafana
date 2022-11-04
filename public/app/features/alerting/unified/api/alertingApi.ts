import { BaseQueryFn, createApi } from '@reduxjs/toolkit/query/react';
import { lastValueFrom } from 'rxjs';

import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime';

import { DashboardDTO } from '../../../../types';
import { DashboardSearchItem } from '../../../search/types';
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

export const dashboardApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    search: build.query<DashboardSearchItem[], { query?: string }>({
      query: ({ query }) => {
        const params = new URLSearchParams({ folderIds: '1', type: 'dash-db', limit: '1000', page: '1' });
        if (query) {
          params.set('query', query);
        }

        return { url: `/api/search?${params.toString()}` };
      },
    }),
    dashboard: build.query<DashboardDTO, { uid: string }>({
      query: ({ uid }) => ({ url: `/api/dashboards/uid/${uid}` }),
    }),
  }),
});
