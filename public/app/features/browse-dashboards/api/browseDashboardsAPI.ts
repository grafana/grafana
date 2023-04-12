import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import { FolderDTO } from 'app/types';

// interface RequestOptions extends BackendSrvRequest {
//   manageError?: (err: unknown) => { error: unknown };
//   showErrorAlert?: boolean;
// }

// function createBackendSrvBaseQuery({ baseURL }: { baseURL: string }): BaseQueryFn<RequestOptions> {
//   async function backendSrvBaseQuery(requestOptions: RequestOptions) {
//     try {
//       const { data: responseData, ...meta } = await lastValueFrom(
//         getBackendSrv().fetch({
//           ...requestOptions,
//           url: baseURL + requestOptions.url,
//           showErrorAlert: requestOptions.showErrorAlert,
//         })
//       );
//       return { data: responseData, meta };
//     } catch (error) {
//       return requestOptions.manageError ? requestOptions.manageError(error) : { error };
//     }
//   }

//   return backendSrvBaseQuery;
// }

export const browseDashboardsAPI = createApi({
  reducerPath: 'browse-dashboards',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  endpoints: (builder) => ({
    getFolder: builder.query<FolderDTO, string>({
      query: (folderUID) => `/folders/${folderUID}`,
    }),
  }),
});

export const { useGetFolderQuery } = browseDashboardsAPI;
export { skipToken } from '@reduxjs/toolkit/query/react';
