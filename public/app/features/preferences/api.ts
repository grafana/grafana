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

export interface UpdateRequestArg {
  body: {
    navbar: {
      savedItems: PreferenceNavLink[];
    };
  };
}

const URL = 'user/preferences';
export const preferencesAPI = createApi({
  reducerPath: 'preferencesAPI',
  baseQuery: createBackendSrvBaseQuery({ baseURL: '/api' }),
  tagTypes: ['UserPreferences'],
  endpoints: (build) => ({
    loadUserPreferences: build.query<Preferences, void>({
      query: (queryArg) => ({ url: URL }),
      providesTags: ['UserPreferences'],
    }),
    updateUserPreferences: build.mutation<Preferences, UpdateRequestArg>({
      query: ({ body }) => ({
        url: URL,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['UserPreferences'],
    }),
    patchUserPreferences: build.mutation<Preferences, UpdateRequestArg>({
      query: ({ body }) => ({
        url: URL,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['UserPreferences'],
    }),
  }),
});

export const { useLoadUserPreferencesQuery, useUpdateUserPreferencesMutation, usePatchUserPreferencesMutation } =
  preferencesAPI;
