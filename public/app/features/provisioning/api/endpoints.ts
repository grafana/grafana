import { baseAPI as api } from './baseAPI';
import {
  RepositoryList,
  RepositoryResource,
  RequestArg,
  UpdateRequestArg,
  HelloWorld,
  RepositoryForCreate,
} from './types';

const BASE_PATH = '/repositories';

const injectedRtkApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Queries
    listRepository: build.query<RepositoryList, void>({
      query: () => ({ url: BASE_PATH }),
    }),
    getRepository: build.query<RepositoryResource, { name: string }>({
      query: ({ name }) => ({ url: `${BASE_PATH}/${name}` }),
    }),
    connectGetRepositoryHello: build.query<HelloWorld, { name: string; whom?: string }>({
      query: ({ name, whom }) => ({
        url: `${BASE_PATH}/${name}/hello`,
        params: { whom },
      }),
    }),

    // Mutations
    createRepository: build.mutation<void, RepositoryForCreate>({
      query: (resource) => ({
        url: BASE_PATH,
        method: 'POST',
        body: resource,
      }),
    }),
    updateRepository: build.mutation<void, UpdateRequestArg>({
      query: ({ name, body }) => ({
        url: `${BASE_PATH}/${name}`,
        method: 'PUT',
        body,
      }),
    }),
    deleteRepository: build.mutation<void, RequestArg>({
      query: ({ name }) => ({
        url: `${BASE_PATH}/${name}`,
        method: 'DELETE',
      }),
    }),
    patchRepository: build.mutation<void, UpdateRequestArg>({
      query: ({ name, body }) => ({
        url: `${BASE_PATH}/${name}`,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/merge-patch+json' },
        body,
      }),
    }),
    deleteCollectionRepository: build.mutation<void, RequestArg>({
      query: () => ({
        url: BASE_PATH,
        method: 'DELETE',
      }),
    }),
  }),
  overrideExisting: false,
});

export { injectedRtkApi as generatedAPI };

export const {
  useListRepositoryQuery,
  useCreateRepositoryMutation,
  useDeleteRepositoryMutation,
  useGetRepositoryQuery,
  useUpdateRepositoryMutation,
  usePatchRepositoryMutation,
  useConnectGetRepositoryHelloQuery,
} = injectedRtkApi;
