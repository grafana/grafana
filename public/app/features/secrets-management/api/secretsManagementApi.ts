import { createApi } from '@reduxjs/toolkit/query/react';

import { createBaseQuery } from 'app/api/createBaseQuery';
import { getAPIBaseURL } from 'app/api/utils';

import { Secret, SecretsListResponse, SecretsListResponseItem } from '../types';

const baseURL = getAPIBaseURL('secret.grafana.app', 'v0alpha1');

export const secretsManagementApi = createApi({
  tagTypes: ['Secrets'],
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
          ? [...result.map(({ name }) => ({ type: 'Secrets' as const, id: name })), { type: 'Secrets', id: 'LIST' }]
          : [{ type: 'Secrets', id: 'LIST' }],
      transformResponse: (response: SecretsListResponse) => {
        return (
          (response?.items?.map((item) => ({
            name: item.metadata.name,
            description: item.spec.description,
            audiences: item.spec.decrypters,
            uid: item.metadata.uid,
            status: item.status?.phase ?? 'Succeeded',
            ...('keeper' in item.spec ? { keeper: item.spec.keeper } : undefined),
          })) as Secret[]) ?? []
        );
      },
    }),
    getSecret: builder.query<Secret, string>({
      query: (name) => ({
        url: `/securevalues/${encodeURIComponent(name)}`,
        method: 'GET',
      }),
      providesTags: (_result, _error, name) => [{ type: 'Secrets', id: name }],
      transformResponse: (response: SecretsListResponseItem) => {
        return {
          name: response.metadata.name,
          description: response.spec.description,
          audiences: response.spec.decrypters,
          uid: response.metadata.uid,
          status: response.status?.phase ?? 'Succeeded',
          ...('keeper' in response.spec ? { keeper: response.spec.keeper } : undefined),
        } as Secret;
      },
    }),
    deleteSecret: builder.mutation({
      query: (name) => ({
        url: `/securevalues/${encodeURIComponent(name)}`,
        method: 'DELETE',
      }),
      // invalidatesTags: (result, error, name) => [{ type: 'Secrets', id: name }],
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
        body: data,
      }),
    }),
    updateSecret: builder.mutation({
      query: ({ name, ...data }) => ({
        url: `/securevalues/${encodeURIComponent(name)}`,
        method: 'PUT',
        body: data,
      }),
    }),
  }),
});

export const {
  useListSecretsQuery,
  useDeleteSecretMutation,
  useCreateSecretMutation,
  useUpdateSecretMutation,
  useGetSecretQuery,
} = secretsManagementApi;
