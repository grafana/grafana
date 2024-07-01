import { BaseQueryFn, createApi } from '@reduxjs/toolkit/query/react';
import { lastValueFrom } from 'rxjs';

import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime';
import { PreferenceNavLink, Preferences } from '@grafana/schema';

interface RequestOptions extends BackendSrvRequest {
  manageError?: (err: unknown) => { error: unknown };
  showErrorAlert?: boolean;
  body?: BackendSrvRequest['data'];
}

function createBackendSrvBaseQuery({ baseURL }: { baseURL: string }): BaseQueryFn<RequestOptions> {
  async function backendSrvBaseQuery(requestOptions: RequestOptions) {
    try {
      const { data: responseData, ...meta } = await lastValueFrom(
        getBackendSrv().fetch({
          ...requestOptions,
          url: baseURL + requestOptions.url,
          showErrorAlert: requestOptions.showErrorAlert,
          data: requestOptions.body,
        })
      );
      return { data: responseData, meta };
    } catch (error) {
      return requestOptions.manageError ? requestOptions.manageError(error) : { error };
    }
  }

  return backendSrvBaseQuery;
}

interface QueryArg {
  resource: 'user' | 'org';
}
export interface UpdateRequestArg {
  body: {
    navbar: {
      savedItems: PreferenceNavLink[];
    };
  };
}

interface UpdateQueryArg extends QueryArg, UpdateRequestArg {}

export const preferencesAPI = createApi({
  reducerPath: 'preferencesAPI',
  baseQuery: createBackendSrvBaseQuery({ baseURL: '/api/' }),
  tagTypes: ['Preferences'],
  endpoints: (build) => ({
    loadPreferences: build.query<Preferences, QueryArg>({
      query: (queryArg) => ({ url: `${queryArg.resource}/preferences` }),
      providesTags: ['Preferences'],
    }),
    updatePreferences: build.mutation<Preferences, UpdateQueryArg>({
      query: ({ resource, body }) => ({
        url: `${resource}/preferences`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Preferences'],
    }),
    patchPreferences: build.mutation<Preferences, UpdateQueryArg>({
      query: ({ resource, body }) => ({
        url: `${resource}/preferences`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Preferences'],
    }),
  }),
});

export const { useLoadPreferencesQuery, useUpdatePreferencesMutation, usePatchPreferencesMutation } = preferencesAPI;
