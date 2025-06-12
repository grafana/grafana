import { createApi } from '@reduxjs/toolkit/query/react';

import { createBaseQuery } from 'app/api/createBaseQuery';
import { getAPIBaseURL } from 'app/api/utils';

import { Secret, SecretFormValues, SecretsListResponse, SecretsListResponseItem } from './types';
import { payloadFromFormValues, transformToSecret } from './utils';

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
        result
          ? [
              ...result.map<{ type: 'Secret'; id: string } | 'Secret'>(({ name }) => ({ type: 'Secret', id: name })),
              'Secret',
            ]
          : ['Secret'],
      transformResponse: (response: SecretsListResponse) => {
        return response?.items?.map(transformToSecret) ?? [];
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
    createSecret: builder.mutation<SecretsListResponseItem, SecretFormValues>({
      query: (formValues) => ({
        url: '/securevalues',
        method: 'POST',
        body: payloadFromFormValues(formValues),
      }),
      invalidatesTags: (_result, error) => {
        if (!!error) {
          return [null];
        }

        return ['Secret'];
      },
    }),
    updateSecret: builder.mutation<SecretsListResponseItem, SecretFormValues>({
      query: (formValues) => ({
        url: `/securevalues/${encodeURIComponent(formValues.name)}`,
        method: 'PUT',
        body: payloadFromFormValues(formValues),
      }),
      invalidatesTags: (_result, _error, arg) => [{ type: 'Secret', id: arg.name }],
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
