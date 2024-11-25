import { baseAPI as api } from './baseAPI';
import {
  RepositoryList,
  RepositoryResource,
  RequestArg,
  UpdateRequestArg,
  HelloWorld,
  RepositoryForCreate,
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
      invalidatesTags: ['RepositoryList'],
    }),
    getRepositoryExport: build.query<ResourceWrapper, RequestArg>({
      query: ({ name }) => ({
        url: `${BASE_PATH}/${name}/export`,
      }),
    }),
    createRepositoryExport: build.mutation<ResourceWrapper, RequestArg>({
      query: ({ name }) => ({
        url: `${BASE_PATH}/${name}/export`,
        method: 'POST',
      }),
    }),
    getRepositoryFiles: build.query<ResourceWrapper, GetFileArg>({
      query: ({ name, path, ref }) => ({
        url: `${BASE_PATH}/${name}/files/${path}`,
        params: { ref },
      }),
    }),
    updateRepositoryFiles: build.mutation<ResourceWrapper, FileOperationArg>({
      query: ({ name, path, body, ref, message }) => ({
        url: `${BASE_PATH}/${name}/files/${path}`,
        method: 'PUT',
        body,
        params: { ref, message },
      }),
    }),
    createRepositoryFiles: build.mutation<ResourceWrapper, FileOperationArg>({
      query: ({ name, path, body, ref, message }) => ({
        url: `${BASE_PATH}/${name}/files/${path}`,
        method: 'POST',
        body,
        params: { ref, message },
      }),
    }),
    deleteRepositoryFiles: build.mutation<
      ResourceWrapper,
      { name: string; path: string; ref?: string; message?: string }
    >({
      query: ({ name, path, ref, message }) => ({
        url: `${BASE_PATH}/${name}/files/${path}`,
        method: 'DELETE',
        params: { ref, message },
      }),
    }),
    getRepositoryHello: build.query<HelloWorld, { name: string; whom?: string }>({
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
        headers: { 'Content-Type': 'application/merge-patch+json' },
        body,
      }),
    }),
    getRepositoryWebhook: build.query<WebhookResponse, RequestArg>({
      query: ({ name }) => ({
        url: `${BASE_PATH}/${name}/webhook`,
      }),
    }),
    createRepositoryWebhook: build.mutation<WebhookResponse, RequestArg>({
      query: ({ name }) => ({
        url: `${BASE_PATH}/${name}/webhook`,
        method: 'POST',
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
  useGetRepositoryExportQuery,
  useCreateRepositoryExportMutation,
  useGetRepositoryFilesQuery,
  useUpdateRepositoryFilesMutation,
  useCreateRepositoryFilesMutation,
  useDeleteRepositoryFilesMutation,
  useGetRepositoryHelloQuery,
  useGetRepositoryStatusQuery,
  useUpdateRepositoryStatusMutation,
  usePatchRepositoryStatusMutation,
  useGetRepositoryWebhookQuery,
  useCreateRepositoryWebhookMutation,
} = injectedRtkApi;
