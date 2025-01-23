import { baseAPI as api } from './baseAPI';
export const addTagTypes = ['Job', 'Repository'] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      listJob: build.query<ListJobResponse, ListJobArg | void>({
        query: (queryArg) => ({
          url: `/jobs`,
        }),
        providesTags: ['Job'],
      }),
      getJob: build.query<GetJobResponse, GetJobArg>({
        query: (queryArg) => ({
          url: `/jobs/${queryArg.name}`,
          params: {
            pretty: queryArg.pretty,
          },
        }),
        providesTags: ['Job'],
      }),
      listRepository: build.query<ListRepositoryResponse, ListRepositoryArg | void>({
        query: (queryArg) => ({
          url: `/repositories`,
        }),
        providesTags: ['Repository'],
      }),
      createRepository: build.mutation<CreateRepositoryResponse, CreateRepositoryArg>({
        query: (queryArg) => ({
          url: `/repositories`,
          method: 'POST',
          body: queryArg.body,
          params: {
            pretty: queryArg.pretty,
            dryRun: queryArg.dryRun,
            fieldManager: queryArg.fieldManager,
            fieldValidation: queryArg.fieldValidation,
          },
        }),
        invalidatesTags: ['Repository'],
      }),
      getRepository: build.query<GetRepositoryResponse, GetRepositoryArg>({
        query: (queryArg) => ({
          url: `/repositories/${queryArg.name}`,
          params: {
            pretty: queryArg.pretty,
          },
        }),
        providesTags: ['Repository'],
      }),
      replaceRepository: build.mutation<ReplaceRepositoryResponse, ReplaceRepositoryArg>({
        query: (queryArg) => ({
          url: `/repositories/${queryArg.name}`,
          method: 'PUT',
          body: queryArg.body,
          params: {
            pretty: queryArg.pretty,
            dryRun: queryArg.dryRun,
            fieldManager: queryArg.fieldManager,
            fieldValidation: queryArg.fieldValidation,
          },
        }),
        invalidatesTags: ['Repository'],
      }),
      deleteRepository: build.mutation<DeleteRepositoryResponse, DeleteRepositoryArg>({
        query: (queryArg) => ({
          url: `/repositories/${queryArg.name}`,
          method: 'DELETE',
          body: queryArg.body,
          params: {
            pretty: queryArg.pretty,
            dryRun: queryArg.dryRun,
            gracePeriodSeconds: queryArg.gracePeriodSeconds,
            ignoreStoreReadErrorWithClusterBreakingPotential: queryArg.ignoreStoreReadErrorWithClusterBreakingPotential,
            orphanDependents: queryArg.orphanDependents,
            propagationPolicy: queryArg.propagationPolicy,
          },
        }),
        invalidatesTags: ['Repository'],
      }),
      createRepositoryExport: build.mutation<CreateRepositoryExportResponse, CreateRepositoryExportArg>({
        query: (queryArg) => ({
          url: `/repositories/${queryArg.name}/export`,
          method: 'POST',
          body: queryArg.body,
        }),
        invalidatesTags: ['Repository'],
      }),
      getRepositoryFiles: build.query<GetRepositoryFilesResponse, GetRepositoryFilesArg>({
        query: (queryArg) => ({
          url: `/repositories/${queryArg.name}/files/`,
          params: {
            ref: queryArg.ref,
          },
        }),
        providesTags: ['Repository'],
      }),
      getRepositoryFilesWithPath: build.query<GetRepositoryFilesWithPathResponse, GetRepositoryFilesWithPathArg>({
        query: (queryArg) => ({
          url: `/repositories/${queryArg.name}/files/${queryArg.path}`,
          params: {
            ref: queryArg.ref,
          },
        }),
        providesTags: ['Repository'],
      }),
      replaceRepositoryFilesWithPath: build.mutation<
        ReplaceRepositoryFilesWithPathResponse,
        ReplaceRepositoryFilesWithPathArg
      >({
        query: (queryArg) => ({
          url: `/repositories/${queryArg.name}/files/${queryArg.path}`,
          method: 'PUT',
          body: queryArg.body,
          params: {
            ref: queryArg.ref,
            message: queryArg.message,
          },
        }),
        invalidatesTags: ['Repository'],
      }),
      createRepositoryFilesWithPath: build.mutation<
        CreateRepositoryFilesWithPathResponse,
        CreateRepositoryFilesWithPathArg
      >({
        query: (queryArg) => ({
          url: `/repositories/${queryArg.name}/files/${queryArg.path}`,
          method: 'POST',
          body: queryArg.body,
          params: {
            ref: queryArg.ref,
            message: queryArg.message,
          },
        }),
        invalidatesTags: ['Repository'],
      }),
      deleteRepositoryFilesWithPath: build.mutation<
        DeleteRepositoryFilesWithPathResponse,
        DeleteRepositoryFilesWithPathArg
      >({
        query: (queryArg) => ({
          url: `/repositories/${queryArg.name}/files/${queryArg.path}`,
          method: 'DELETE',
          params: {
            ref: queryArg.ref,
            message: queryArg.message,
          },
        }),
        invalidatesTags: ['Repository'],
      }),
      getRepositoryHistory: build.query<GetRepositoryHistoryResponse, GetRepositoryHistoryArg>({
        query: (queryArg) => ({
          url: `/repositories/${queryArg.name}/history`,
          params: {
            ref: queryArg.ref,
          },
        }),
        providesTags: ['Repository'],
      }),
      getRepositoryHistoryWithPath: build.query<GetRepositoryHistoryWithPathResponse, GetRepositoryHistoryWithPathArg>({
        query: (queryArg) => ({
          url: `/repositories/${queryArg.name}/history/${queryArg.path}`,
          params: {
            ref: queryArg.ref,
          },
        }),
        providesTags: ['Repository'],
      }),
      getRepositoryResources: build.query<GetRepositoryResourcesResponse, GetRepositoryResourcesArg>({
        query: (queryArg) => ({
          url: `/repositories/${queryArg.name}/resources`,
        }),
        providesTags: ['Repository'],
      }),
      getRepositoryStatus: build.query<GetRepositoryStatusResponse, GetRepositoryStatusArg>({
        query: (queryArg) => ({
          url: `/repositories/${queryArg.name}/status`,
          params: {
            pretty: queryArg.pretty,
          },
        }),
        providesTags: ['Repository'],
      }),
      replaceRepositoryStatus: build.mutation<ReplaceRepositoryStatusResponse, ReplaceRepositoryStatusArg>({
        query: (queryArg) => ({
          url: `/repositories/${queryArg.name}/status`,
          method: 'PUT',
          body: queryArg.body,
          params: {
            pretty: queryArg.pretty,
            dryRun: queryArg.dryRun,
            fieldManager: queryArg.fieldManager,
            fieldValidation: queryArg.fieldValidation,
          },
        }),
        invalidatesTags: ['Repository'],
      }),
      createRepositorySync: build.mutation<CreateRepositorySyncResponse, CreateRepositorySyncArg>({
        query: (queryArg) => ({
          url: `/repositories/${queryArg.name}/sync`,
          method: 'POST',
        }),
        invalidatesTags: ['Repository'],
      }),
      createRepositoryTest: build.mutation<CreateRepositoryTestResponse, CreateRepositoryTestArg>({
        query: (queryArg) => ({
          url: `/repositories/${queryArg.name}/test`,
          method: 'POST',
          body: queryArg.body,
        }),
        invalidatesTags: ['Repository'],
      }),
      getRepositoryWebhook: build.query<GetRepositoryWebhookResponse, GetRepositoryWebhookArg>({
        query: (queryArg) => ({
          url: `/repositories/${queryArg.name}/webhook`,
        }),
        providesTags: ['Repository'],
      }),
      createRepositoryWebhook: build.mutation<CreateRepositoryWebhookResponse, CreateRepositoryWebhookArg>({
        query: (queryArg) => ({
          url: `/repositories/${queryArg.name}/webhook`,
          method: 'POST',
        }),
        invalidatesTags: ['Repository'],
      }),
      getResourceStats: build.query<GetResourceStatsResponse, GetResourceStatsArg>({
        query: (queryArg) => ({
          url: `/stats`,
        }),
        providesTags: ['Repository'],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as generatedAPI };
export type ListJobResponse = JobList;
export type ListJobArg = {};
export type GetJobResponse = Job;
export type GetJobArg = {
  name: string;
  pretty?: string;
};
export type ListRepositoryResponse = RepositoryList;
export type ListRepositoryArg = {};
export type CreateRepositoryResponse = Repository;
export type CreateRepositoryArg = {
  pretty?: string;
  dryRun?: string;
  fieldManager?: string;
  fieldValidation?: string;
  body: Repository;
};
export type GetRepositoryResponse = Repository;
export type GetRepositoryArg = {
  name: string;
  pretty?: string;
};
export type ReplaceRepositoryResponse = Repository;
export type ReplaceRepositoryArg = {
  name: string;
  pretty?: string;
  dryRun?: string;
  fieldManager?: string;
  fieldValidation?: string;
  body: Repository;
};
export type DeleteRepositoryResponse = Status;
export type DeleteRepositoryArg = {
  name: string;
  pretty?: string;
  dryRun?: string;
  gracePeriodSeconds?: number;
  ignoreStoreReadErrorWithClusterBreakingPotential?: boolean;
  orphanDependents?: boolean;
  propagationPolicy?: string;
  body: DeleteOptions;
};
export type CreateRepositoryExportResponse = Job;
export type CreateRepositoryExportArg = {
  name: string;
  body: {
    branch?: string;
    folder?: string;
    history?: boolean;
    prefix?: string;
  };
};
export type GetRepositoryFilesResponse = {
  apiVersion?: string;
  items?: any[];
  kind?: string;
  metadata?: any;
};
export type GetRepositoryFilesArg = {
  name: string;
  ref?: string;
};
export type GetRepositoryFilesWithPathResponse = ResourceWrapper;
export type GetRepositoryFilesWithPathArg = {
  name: string;
  path: string;
  ref?: string;
};
export type ReplaceRepositoryFilesWithPathResponse = ResourceWrapper;
export type ReplaceRepositoryFilesWithPathArg = {
  name: string;
  path: string;
  ref?: string;
  message?: string;
  body: {
    [key: string]: any;
  };
};
export type CreateRepositoryFilesWithPathResponse = ResourceWrapper;
export type CreateRepositoryFilesWithPathArg = {
  name: string;
  path: string;
  ref?: string;
  message?: string;
  body: {
    [key: string]: any;
  };
};
export type DeleteRepositoryFilesWithPathResponse = ResourceWrapper;
export type DeleteRepositoryFilesWithPathArg = {
  name: string;
  path: string;
  ref?: string;
  message?: string;
};
export type GetRepositoryHistoryResponse = string;
export type GetRepositoryHistoryArg = {
  name: string;
  ref?: string;
};
export type GetRepositoryHistoryWithPathResponse = string;
export type GetRepositoryHistoryWithPathArg = {
  name: string;
  path: string;
  ref?: string;
};
export type GetRepositoryResourcesResponse = ResourceList;
export type GetRepositoryResourcesArg = {
  name: string;
};
export type GetRepositoryStatusResponse = Repository;
export type GetRepositoryStatusArg = {
  name: string;
  pretty?: string;
};
export type ReplaceRepositoryStatusResponse = Repository;
export type ReplaceRepositoryStatusArg = {
  name: string;
  pretty?: string;
  dryRun?: string;
  fieldManager?: string;
  fieldValidation?: string;
  body: Repository;
};
export type CreateRepositorySyncResponse = Job;
export type CreateRepositorySyncArg = {
  name: string;
};
export type CreateRepositoryTestResponse = TestResults;
export type CreateRepositoryTestArg = {
  name: string;
  body: {
    apiVersion?: string;
    kind?: string;
    metadata?: any;
    spec?: any;
    status?: any;
  };
};
export type GetRepositoryWebhookResponse = WebhookResponse;
export type GetRepositoryWebhookArg = {
  name: string;
};
export type CreateRepositoryWebhookResponse = WebhookResponse;
export type CreateRepositoryWebhookArg = {
  name: string;
};
export type GetResourceStatsResponse = {
  apiVersion?: string;
  items?: any[];
  kind?: string;
  metadata?: any;
};
export type GetResourceStatsArg = {};
export type Time = string;
export type FieldsV1 = object;
export type ManagedFieldsEntry = {
  apiVersion?: string;
  fieldsType?: string;
  fieldsV1?: FieldsV1;
  manager?: string;
  operation?: string;
  subresource?: string;
  time?: Time;
};
export type OwnerReference = {
  apiVersion: string;
  blockOwnerDeletion?: boolean;
  controller?: boolean;
  kind: string;
  name: string;
  uid: string;
};
export type ObjectMeta = {
  annotations?: {
    [key: string]: string;
  };
  creationTimestamp?: Time;
  deletionGracePeriodSeconds?: number;
  deletionTimestamp?: Time;
  finalizers?: string[];
  generateName?: string;
  generation?: number;
  labels?: {
    [key: string]: string;
  };
  managedFields?: ManagedFieldsEntry[];
  name?: string;
  namespace?: string;
  ownerReferences?: OwnerReference[];
  resourceVersion?: string;
  selfLink?: string;
  uid?: string;
};
export type ExportOptions = {
  branch?: string;
  folder?: string;
  history?: boolean;
  prefix?: string;
};
export type JobSpec = {
  action: 'export' | 'pr' | 'sync';
  export?: ExportOptions;
  hash?: string;
  pr?: number;
  ref?: string;
  url?: string;
};
export type JobStatus = {
  errors?: string[];
  finished?: number;
  message?: string;
  progress?: number;
  started?: number;
  state?: 'error' | 'pending' | 'success' | 'working';
};
export type Job = {
  apiVersion?: string;
  kind?: string;
  metadata?: ObjectMeta;
  spec?: JobSpec;
  status?: JobStatus;
};
export type ListMeta = {
  continue?: string;
  remainingItemCount?: number;
  resourceVersion?: string;
  selfLink?: string;
};
export type JobList = {
  apiVersion?: string;
  items?: Job[];
  kind?: string;
  metadata?: ListMeta;
};
export type EditingOptions = {
  create: boolean;
  delete: boolean;
  update: boolean;
};
export type GitHubRepositoryConfig = {
  branch?: string;
  branchWorkflow?: boolean;
  generateDashboardPreviews?: boolean;
  owner?: string;
  pullRequestLinter?: boolean;
  repository?: string;
  token?: string;
};
export type LocalRepositoryConfig = {
  path?: string;
};
export type S3RepositoryConfig = {
  bucket?: string;
  region?: string;
};
export type RepositorySpec = {
  description?: string;
  editing: EditingOptions;
  folder?: string;
  github?: GitHubRepositoryConfig;
  linting?: boolean;
  local?: LocalRepositoryConfig;
  s3?: S3RepositoryConfig;
  title: string;
  type: 'github' | 'local' | 's3';
};
export type HealthStatus = {
  checked?: number;
  healthy: boolean;
  message?: string[];
};
export type ResourceCount = {
  count: number;
  group: string;
  repository?: string;
  resource: string;
};
export type SyncStatus = {
  finished?: number;
  hash?: string;
  job?: string;
  message?: string[];
  scheduled?: number;
  started?: number;
  state: 'error' | 'pending' | 'success' | 'working';
};
export type WebhookStatus = {
  id?: number;
  secret?: string;
  subscribedEvents?: string[];
  url?: string;
};
export type RepositoryStatus = {
  health: HealthStatus;
  observedGeneration: number;
  stats?: ResourceCount[];
  sync: SyncStatus;
  webhook: WebhookStatus;
};
export type Repository = {
  apiVersion?: string;
  kind?: string;
  metadata?: ObjectMeta;
  spec?: RepositorySpec;
  status?: RepositoryStatus;
};
export type RepositoryList = {
  apiVersion?: string;
  items?: Repository[];
  kind?: string;
  metadata?: ListMeta;
};
export type StatusCause = {
  field?: string;
  message?: string;
  reason?: string;
};
export type StatusDetails = {
  causes?: StatusCause[];
  group?: string;
  kind?: string;
  name?: string;
  retryAfterSeconds?: number;
  uid?: string;
};
export type Status = {
  apiVersion?: string;
  code?: number;
  details?: StatusDetails;
  kind?: string;
  message?: string;
  metadata?: ListMeta;
  reason?: string;
  status?: string;
};
export type Preconditions = {
  resourceVersion?: string;
  uid?: string;
};
export type DeleteOptions = {
  apiVersion?: string;
  dryRun?: string[];
  gracePeriodSeconds?: number;
  ignoreStoreReadErrorWithClusterBreakingPotential?: boolean;
  kind?: string;
  orphanDependents?: boolean;
  preconditions?: Preconditions;
  propagationPolicy?: string;
};
export type LintIssue = {
  message: string;
  rule: string;
  severity: 'error' | 'exclude' | 'fixed' | 'quiet' | 'warning';
};
export type Unstructured = {
  [key: string]: any;
};
export type ResourceType = {
  classic?: 'access-control' | 'alerting' | 'dashboard' | 'datasources';
  group?: string;
  kind?: string;
  resource?: string;
  version?: string;
};
export type ResourceObjects = {
  action?: 'create' | 'delete' | 'update';
  dryRun?: Unstructured;
  existing?: Unstructured;
  file?: Unstructured;
  type: ResourceType;
};
export type ResourceWrapper = {
  apiVersion?: string;
  errors?: string[];
  hash?: string;
  kind?: string;
  lint?: LintIssue[];
  path?: string;
  ref?: string;
  resource: ResourceObjects;
  timestamp?: Time;
};
export type ResourceListItem = {
  folder?: string;
  group: string;
  hash: string;
  name: string;
  path: string;
  resource: string;
  time?: number;
  title?: string;
};
export type ResourceList = {
  apiVersion?: string;
  items?: ResourceListItem[];
  kind?: string;
  metadata?: ListMeta;
};
export type TestResults = {
  apiVersion?: string;
  code: number;
  details?: Unstructured;
  errors?: string[];
  kind?: string;
  success: boolean;
};
export type WebhookResponse = {
  added?: string;
  apiVersion?: string;
  code?: number;
  job?: JobSpec;
  kind?: string;
};
export const {
  useListJobQuery,
  useGetJobQuery,
  useListRepositoryQuery,
  useCreateRepositoryMutation,
  useGetRepositoryQuery,
  useReplaceRepositoryMutation,
  useDeleteRepositoryMutation,
  useCreateRepositoryExportMutation,
  useGetRepositoryFilesQuery,
  useGetRepositoryFilesWithPathQuery,
  useReplaceRepositoryFilesWithPathMutation,
  useCreateRepositoryFilesWithPathMutation,
  useDeleteRepositoryFilesWithPathMutation,
  useGetRepositoryHistoryQuery,
  useGetRepositoryHistoryWithPathQuery,
  useGetRepositoryResourcesQuery,
  useGetRepositoryStatusQuery,
  useReplaceRepositoryStatusMutation,
  useCreateRepositorySyncMutation,
  useCreateRepositoryTestMutation,
  useGetRepositoryWebhookQuery,
  useCreateRepositoryWebhookMutation,
  useGetResourceStatsQuery,
} = injectedRtkApi;
