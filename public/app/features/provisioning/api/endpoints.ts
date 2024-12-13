import { Resource } from 'app/features/apiserver/types';

import { parseListOptionsSelector } from '../../apiserver/client';

import { baseAPI as api } from './baseAPI';
import {
  RepositoryList,
  RepositoryResource,
  RequestArg,
  UpdateRequestArg,
  RepositoryForCreate,
  ResourceWrapper,
  FileOperationArg,
  GetFileArg,
  ListFilesApiResponse,
  HistoryListResponse,
  TestResponse,
  RepositorySpec,
  JobList,
  JobResource,
  ListApiArg,
  WebhookResponse,
  HistoryItem,
  GetRequestArg,
} from './types';

const BASE_PATH = '/repositories';

const injectedRtkApi = api.injectEndpoints({
  endpoints: (build) => ({
    listJobs: build.query<JobList, ListApiArg | void>({
      query: (queryArg) => {
        return {
          url: `/jobs`,
          params: getListParams(queryArg),
        };
      },
      providesTags: ['JobList'],
    }),
    getJob: build.query<JobResource, RequestArg>({
      query: (queryArg) => ({
        url: `/jobs/${queryArg.name}`,
      }),
    }),
    listRepository: build.query<RepositoryList, ListApiArg | void>({
      query: (params) => ({
        url: `${BASE_PATH}`,
        params: getListParams(params),
      }),
      providesTags: ['RepositoryList'],
    }),
    createRepository: build.mutation<void, RepositoryForCreate>({
      query: (body) => ({
        url: BASE_PATH,
        method: 'POST',
        body,
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
    getRepository: build.query<RepositoryResource, RequestArg>({
      query: (queryArg) => ({
        url: `${BASE_PATH}/${queryArg.name}`,
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
    listRepositoryFiles: build.query<ListFilesApiResponse, { name: string; ref?: string }>({
      query: ({ name, ref }) => ({
        url: `${BASE_PATH}/${name}/files/`,
        params: { ref },
      }),
    }),
    listRepositoryFileHistory: build.query<HistoryListResponse, { name: string; path: string; ref?: string }>({
      query: ({ name, ref, path }) => ({
        url: `${BASE_PATH}/${name}/history/${path}`,
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
    listRepositoryHistory: build.query<HistoryListResponse, RequestArg>({
      query: (queryArg) => ({
        url: `${BASE_PATH}/${queryArg.name}/history`,
        params: { ref: queryArg.ref },
      }),
    }),
    getRepositoryHistory: build.query<HistoryItem, GetRequestArg>({
      query: (queryArg) => ({
        url: `${BASE_PATH}/${queryArg.name}/history/${queryArg.path}`,
        params: { ref: queryArg.ref },
      }),
    }),
    createRepositorySync: build.mutation<ResourceWrapper, { name: string }>({
      query: ({ name }) => ({
        url: `${BASE_PATH}/${name}/sync`,
        method: 'POST',
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
    testRepository: build.query<TestResponse, { name: string }>({
      query: ({ name }) => ({
        url: `${BASE_PATH}/${name}/test`,
        method: 'POST', // tests the existing configuration
      }),
    }),
    testRepositoryConfig: build.mutation<TestResponse, Resource<RepositorySpec>>({
      query: ({ metadata }) => ({
        url: `${BASE_PATH}/${metadata.name ?? 'new'}/test`,
        method: 'POST',
      }),
    }),
    getRepositoryWebhook: build.query<WebhookResponse, RequestArg>({
      query: (queryArg) => ({
        url: `${BASE_PATH}/${queryArg.name}/webhook`,
      }),
    }),
    postRepositoryWebhook: build.mutation<WebhookResponse, RequestArg>({
      query: (queryArg) => ({
        url: `${BASE_PATH}/${queryArg.name}/webhook`,
        method: 'POST',
      }),
    }),
  }),
  overrideExisting: false,
});

export { injectedRtkApi as generatedAPI };

export const {
  useListRepositoryQuery,
  useListJobsQuery,
  useCreateRepositoryMutation,
  useGetRepositoryQuery,
  useUpdateRepositoryMutation,
  useDeleteRepositoryMutation,
  usePatchRepositoryMutation,
  useCreateRepositoryExportMutation,
  useGetRepositoryFilesQuery,
  useListRepositoryFilesQuery,
  useListRepositoryFileHistoryQuery,
  useUpdateRepositoryFilesMutation,
  useCreateRepositoryFilesMutation,
  useDeleteRepositoryFilesMutation,
  useCreateRepositorySyncMutation,
  useGetRepositoryStatusQuery,
  useUpdateRepositoryStatusMutation,
  usePatchRepositoryStatusMutation,
  useTestRepositoryQuery,
  useTestRepositoryConfigMutation,
} = injectedRtkApi;

function getListParams(queryArg: ListApiArg | void) {
  if (!queryArg) {
    return undefined;
  }
  const { fieldSelector, labelSelector, ...params } = queryArg;
  return {
    fieldSelector: fieldSelector ? parseListOptionsSelector(fieldSelector) : undefined,
    labelSelector: labelSelector ? parseListOptionsSelector(labelSelector) : undefined,
    ...params,
  };
}
