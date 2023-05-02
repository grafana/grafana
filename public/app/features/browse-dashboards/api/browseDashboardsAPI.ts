import { BaseQueryFn, createApi } from '@reduxjs/toolkit/query/react';
import { lastValueFrom } from 'rxjs';

import { isTruthy } from '@grafana/data';
import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime';
import { DescendantCount, FolderDTO } from 'app/types';

import { DashboardTreeSelection } from '../types';

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
    getAffectedItems: builder.query<DescendantCount, DashboardTreeSelection>({
      queryFn: async (selectedItems) => {
        const folderUIDs = Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]);
        const promises = folderUIDs.map((folderUID) => {
          return getBackendSrv().get<DescendantCount>(`/api/folders/${folderUID}/counts`);
        });

        const results = await Promise.all(promises);
        const aggregatedResults = results.reduce(
          (acc, val) => {
            acc.folder += val.folder;
            acc.dashboard += val.dashboard;

            // TODO enable these once the backend correctly returns them
            // acc.libraryPanel += val.libraryPanel;
            // acc.alertRule += val.alertRule;
            return acc;
          },
          {
            folder: Object.values(selectedItems.folder).filter(isTruthy).length,
            dashboard: Object.values(selectedItems.dashboard).filter(isTruthy).length,
            libraryPanel: 0,
            alertRule: 0,
          }
        );

        return { data: aggregatedResults };
      },
    }),
  }),
});

export const { useGetAffectedItemsQuery, useGetFolderQuery } = browseDashboardsAPI;
export { skipToken } from '@reduxjs/toolkit/query/react';
