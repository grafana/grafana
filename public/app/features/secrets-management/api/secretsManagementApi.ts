import { createApi } from '@reduxjs/toolkit/query/react';

import { createBaseQuery } from 'app/api/createBaseQuery';
import { getAPIBaseURL } from 'app/api/utils';

import { Secret, SecretsListResponse, SecretsListResponseItem } from '../types';
import { transformFromSecret, transformToSecret } from '../utils';

const baseURL = getAPIBaseURL('secret.grafana.app', 'v0alpha1');

export const secretsManagementApi = createApi({
  tagTypes: ['Secret'],
  reducerPath: 'secretsManagementApi',
  baseQuery: createBaseQuery({ baseURL }),
  endpoints: (builder) => ({
    listSecrets: builder.query<Secret[], void>({
      query: () => ({
        url: '/securevalues',
        method: 'GET',
      }),
      providesTags: (result) =>
        result ? [...result.map(({ name }) => ({ type: 'Secret' as const, id: name })), 'Secret'] : ['Secret'],
      transformResponse: (response: SecretsListResponse) => {
        return (response?.items?.map(transformToSecret) as Secret[]) ?? [];
      },
    }),
    getSecret: builder.query<Secret, string>({
      query: (name) => ({
        url: `/securevalues/${encodeURIComponent(name)}`,
        method: 'GET',
      }),
      providesTags: (_result, _error, name) => [{ type: 'Secret', id: name }],
      transformResponse: (response: SecretsListResponseItem) => {
        return transformToSecret(response);
      },
    }),
    deleteSecret: builder.mutation({
      query: (name) => ({
        url: `/securevalues/${encodeURIComponent(name)}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Secret', id: arg }],
      async onQueryStarted(name, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          secretsManagementApi.util.updateQueryData('listSecrets', undefined, (draft) => {
            draft.splice(
              draft.findIndex((item) => item.name === name),
              1
            );
          })
        );
        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
    }),
    createSecret: builder.mutation({
      query: (data) => ({
        url: '/securevalues',
        method: 'POST',
        body: transformFromSecret(data),
      }),
      invalidatesTags: (result, error, arg, meta) => {
        if (!!error) {
          return [null];
        }

        return ['Secret'];
      },
    }),
    updateSecret: builder.mutation<Secret, Partial<Secret> & Pick<Secret, 'name'>>({
      query: (secret) => ({
        url: `/securevalues/${encodeURIComponent(secret.name)}`,
        method: 'PUT',
        body: transformFromSecret(secret),
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Secret', id: arg.name }],
    }),
  }),
});

// Secret mutation factory
export function useSecretMutation(update = false) {
  return update ? useUpdateSecretMutation() : useCreateSecretMutation();
}

export const {
  useListSecretsQuery,
  useDeleteSecretMutation,
  useCreateSecretMutation,
  useUpdateSecretMutation,
  useGetSecretQuery,
} = secretsManagementApi;
