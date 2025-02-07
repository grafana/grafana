import { baseAPI as api } from './baseAPI';
export const addTagTypes = ['Repository'] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      listRepository: build.query<ListRepositoryResponse, ListRepositoryArg>({
        query: (queryArg) => ({
          url: `/repositories`,
          params: {
            pretty: queryArg.pretty,
            allowWatchBookmarks: queryArg.allowWatchBookmarks,
            continue: queryArg['continue'],
            fieldSelector: queryArg.fieldSelector,
            labelSelector: queryArg.labelSelector,
            limit: queryArg.limit,
            resourceVersion: queryArg.resourceVersion,
            resourceVersionMatch: queryArg.resourceVersionMatch,
            sendInitialEvents: queryArg.sendInitialEvents,
            timeoutSeconds: queryArg.timeoutSeconds,
            watch: queryArg.watch,
          },
        }),
        providesTags: ['Repository'],
      }),
      createRepository: build.mutation<CreateRepositoryResponse, CreateRepositoryArg>({
        query: (queryArg) => ({
          url: `/repositories`,
          method: 'POST',
          body: queryArg.repository,
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
          body: queryArg.repository,
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
          body: queryArg.deleteOptions,
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
          body: queryArg.repository,
          params: {
            pretty: queryArg.pretty,
            dryRun: queryArg.dryRun,
            fieldManager: queryArg.fieldManager,
            fieldValidation: queryArg.fieldValidation,
          },
        }),
        invalidatesTags: ['Repository'],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as generatedAPI };
export type ListRepositoryResponse =  RepositoryList;
export type ListRepositoryArg = {
  pretty?: string;
  allowWatchBookmarks?: boolean;
  continue?: string;
  fieldSelector?: string;
  labelSelector?: string;
  limit?: number;
  resourceVersion?: string;
  resourceVersionMatch?: string;
  sendInitialEvents?: boolean;
  timeoutSeconds?: number;
  watch?: boolean;
};
export type CreateRepositoryResponse = | Repository;
export type CreateRepositoryArg = {
  pretty?: string;
  dryRun?: string;
  fieldManager?: string;
  fieldValidation?: string;
  repository: Repository;
};
export type GetRepositoryResponse =  Repository;
export type GetRepositoryArg = {
  name: string;
  pretty?: string;
};
export type ReplaceRepositoryResponse =  Repository | Repository;
export type ReplaceRepositoryArg = {
  name: string;
  pretty?: string;
  dryRun?: string;
  fieldManager?: string;
  fieldValidation?: string;
  repository: Repository;
};
export type DeleteRepositoryResponse =  Status | Status;
export type DeleteRepositoryArg = {
  name: string;
  pretty?: string;
  dryRun?: string;
  gracePeriodSeconds?: number;
  ignoreStoreReadErrorWithClusterBreakingPotential?: boolean;
  orphanDependents?: boolean;
  propagationPolicy?: string;
  deleteOptions: DeleteOptions;
};
export type GetRepositoryStatusResponse =  Repository;
export type GetRepositoryStatusArg = {
  name: string;
  pretty?: string;
};
export type ReplaceRepositoryStatusResponse =  Repository | Repository;
export type ReplaceRepositoryStatusArg = {
  name: string;
  pretty?: string;
  dryRun?: string;
  fieldManager?: string;
  fieldValidation?: string;
  repository: Repository;
};
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
export type GitHubRepositoryConfig = {
  branch?: string;
  branchWorkflow?: boolean;
  generateDashboardPreviews?: boolean;
  owner?: string;
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
export type SyncOptions = {
  enabled: boolean;
  intervalSeconds?: number;
  target: 'folder' | 'instance';
};
export type RepositorySpec = {
  description?: string;
  github?: GitHubRepositoryConfig;
  local?: LocalRepositoryConfig;
  readOnly: boolean;
  s3?: S3RepositoryConfig;
  sync: SyncOptions;
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
  incremental?: boolean;
  job?: string;
  message: string[];
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
export type ListMeta = {
  continue?: string;
  remainingItemCount?: number;
  resourceVersion?: string;
  selfLink?: string;
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
export const {
  useListRepositoryQuery,
  useCreateRepositoryMutation,
  useGetRepositoryQuery,
  useReplaceRepositoryMutation,
  useDeleteRepositoryMutation,
  useGetRepositoryStatusQuery,
  useReplaceRepositoryStatusMutation,
} = injectedRtkApi;
