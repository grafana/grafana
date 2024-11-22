import { baseAPI as api } from './baseAPI';
import {
  RepositoryList,
  RepositoryResource,
  RequestArg,
  UpdateRequestArg,
  HelloWorld,
  RepositoryForCreate,
  WatchEvent,
  WebhookResponse,
  ResourceWrapper,
  FileOperationArg,
  GetFileArg,
} from './types';

const BASE_PATH = '/repositories';

const injectedRtkApi = api.injectEndpoints({
  endpoints: (build) => ({
    listRepository: build.query<RepositoryList, void>({
      query: () => ({ url: BASE_PATH }),
      providesTags: ['RepositoryList'],
    }),
    getRepository: build.query<RepositoryResource, RequestArg>({
      query: ({ name }) => ({ url: `${BASE_PATH}/${name}` }),
    }),
    createRepository: build.mutation<void, RepositoryForCreate>({
      query: (resource) => ({
        url: BASE_PATH,
        method: 'POST',
        body: resource,
      }),
      invalidatesTags: ['RepositoryList'],
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
      invalidatesTags: ['RepositoryList'],
    }),
    patchRepository: build.mutation<void, UpdateRequestArg>({
      query: ({ name, body }) => ({
        url: `${BASE_PATH}/${name}`,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/merge-patch+json' },
        body,
      }),
    }),
    connectGetRepositoryExport: build.query<ResourceWrapper, RequestArg>({
      query: ({ name }) => ({
        url: `${BASE_PATH}/${name}/export`,
      }),
    }),
    connectPostRepositoryExport: build.mutation<ResourceWrapper, RequestArg>({
      query: ({ name }) => ({
        url: `${BASE_PATH}/${name}/export`,
        method: 'POST',
      }),
    }),
    connectGetRepositoryFiles: build.query<ResourceWrapper, GetFileArg>({
      query: ({ name, path, commit }) => ({
        url: `${BASE_PATH}/${name}/files/${path}`,
        params: { commit },
      }),
    }),
    connectPutRepositoryFiles: build.mutation<ResourceWrapper, FileOperationArg>({
      query: ({ name, path, body, message }) => ({
        url: `${BASE_PATH}/${name}/files/${path}`,
        method: 'PUT',
        body,
        params: { message },
      }),
    }),
    connectPostRepositoryFiles: build.mutation<ResourceWrapper, FileOperationArg>({
      query: ({ name, path, body, message }) => ({
        url: `${BASE_PATH}/${name}/files/${path}`,
        method: 'POST',
        body,
        params: { message },
      }),
    }),
    connectDeleteRepositoryFiles: build.mutation<ResourceWrapper, { name: string; path: string; message?: string }>({
      query: ({ name, path, message }) => ({
        url: `${BASE_PATH}/${name}/files/${path}`,
        method: 'DELETE',
        params: { message },
      }),
    }),
    connectGetRepositoryHello: build.query<HelloWorld, { name: string; whom?: string }>({
      query: ({ name, whom }) => ({
        url: `${BASE_PATH}/${name}/hello`,
        params: { whom },
      }),
    }),
    getRepositoryStatus: build.query<RepositoryResource, RequestArg>({
      query: ({ name }) => ({
        url: `${BASE_PATH}/${name}/status`,
      }),
    }),
    updateRepositoryStatus: build.mutation<RepositoryResource, UpdateRequestArg>({
      query: ({ name, body }) => ({
        url: `${BASE_PATH}/${name}/status`,
        method: 'PUT',
        body,
      }),
    }),
    patchRepositoryStatus: build.mutation<RepositoryResource, UpdateRequestArg>({
      query: ({ name, body }) => ({
        url: `${BASE_PATH}/${name}/status`,
        method: 'PATCH',
        body,
      }),
    }),
    connectGetRepositoryWebhook: build.query<WebhookResponse, RequestArg>({
      query: ({ name }) => ({
        url: `${BASE_PATH}/${name}/webhook`,
      }),
    }),
    connectPostRepositoryWebhook: build.mutation<WebhookResponse, RequestArg>({
      query: ({ name }) => ({
        url: `${BASE_PATH}/${name}/webhook`,
        method: 'POST',
      }),
    }),
    watchRepositoryList: build.query<WatchEvent, void>({
      query: () => ({
        url: `${BASE_PATH}`,
        params: { watch: true },
      }),
    }),
    watchRepository: build.query<WatchEvent, RequestArg>({
      query: ({ name }) => ({
        url: `${BASE_PATH}/${name}`,
        params: { watch: true },
      }),
    }),
  }),
  overrideExisting: false,
});

export { injectedRtkApi as generatedAPI };

export const {
  useListRepositoryQuery,
  useCreateRepositoryMutation,
  useGetRepositoryQuery,
  useUpdateRepositoryMutation,
  useDeleteRepositoryMutation,
  usePatchRepositoryMutation,
  useConnectGetRepositoryExportQuery,
  useConnectPostRepositoryExportMutation,
  useConnectGetRepositoryFilesQuery,
  useConnectPutRepositoryFilesMutation,
  useConnectPostRepositoryFilesMutation,
  useConnectDeleteRepositoryFilesMutation,
  useConnectGetRepositoryHelloQuery,
  useGetRepositoryStatusQuery,
  useUpdateRepositoryStatusMutation,
  usePatchRepositoryStatusMutation,
  useConnectGetRepositoryWebhookQuery,
  useConnectPostRepositoryWebhookMutation,
  useWatchRepositoryListQuery,
  useWatchRepositoryQuery,
} = injectedRtkApi;
