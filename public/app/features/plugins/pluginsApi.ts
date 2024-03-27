import { BaseQueryFn, createApi } from '@reduxjs/toolkit/query/react';
import { lastValueFrom } from 'rxjs';

import { PluginMeta } from '@grafana/data';
import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime';

// TODO Most APIs could use the same backendSrvBaseQuery, so we could move this to a shared file
interface RequestOptions extends BackendSrvRequest {
  manageError?: (err: unknown) => { error: unknown };
  showErrorAlert?: boolean;
}

const backendSrvBaseQuery =
  ({ baseUrl }: { baseUrl: string }): BaseQueryFn<RequestOptions> =>
  async (requestOptions) => {
    try {
      const { data: responseData, ...meta } = await lastValueFrom(
        getBackendSrv().fetch({
          ...requestOptions,
          url: baseUrl + requestOptions.url,
          showErrorAlert: requestOptions.showErrorAlert,
        })
      );
      return { data: responseData, meta };
    } catch (error) {
      return requestOptions.manageError ? requestOptions.manageError(error) : { error };
    }
  };

export const pluginsApi = createApi({
  reducerPath: 'pluginsApi',
  baseQuery: backendSrvBaseQuery({ baseUrl: '/api' }),
  endpoints: (builder) => ({
    getSettigns: builder.query<PluginMeta, { pluginId: string }>({
      query: ({ pluginId }) => ({
        url: `/plugins/${pluginId}/settings`,
      }),
    }),
  }),
});
