import { BaseQueryFn, createApi } from '@reduxjs/toolkit/query/react';
import { lastValueFrom } from 'rxjs';

import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime';
import { FolderDTO } from 'app/types';

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

export const browseDashboardsAPI = createApi({
  reducerPath: 'browseDashboardsAPI',
  baseQuery: createBackendSrvBaseQuery({ baseURL: '/api' }),
  endpoints: (builder) => ({
    getFolder: builder.query<FolderDTO, string>({
      query: (folderUID) => ({ url: `/folders/${folderUID}` }),
    }),
  }),
});

export const { useGetFolderQuery } = browseDashboardsAPI;
export { skipToken } from '@reduxjs/toolkit/query/react';
