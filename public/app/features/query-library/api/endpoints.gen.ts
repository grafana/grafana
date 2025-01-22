import { queryLibraryApi as api } from './factory';
export const addTagTypes = ['QueryTemplate'] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      listQueryTemplate: build.query<ListQueryTemplateApiResponse, ListQueryTemplateApiArg>({
        query: (queryArg) => ({
          url: `/querytemplates`,
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
        providesTags: ['QueryTemplate'],
      }),
      createQueryTemplate: build.mutation<CreateQueryTemplateApiResponse, CreateQueryTemplateApiArg>({
        query: (queryArg) => ({
          url: `/querytemplates`,
          method: 'POST',
          body: queryArg.queryTemplate,
          params: {
            pretty: queryArg.pretty,
            dryRun: queryArg.dryRun,
            fieldManager: queryArg.fieldManager,
            fieldValidation: queryArg.fieldValidation,
          },
        }),
        invalidatesTags: ['QueryTemplate'],
      }),
      deleteQueryTemplate: build.mutation<DeleteQueryTemplateApiResponse, DeleteQueryTemplateApiArg>({
        query: (queryArg) => ({
          url: `/querytemplates/${queryArg.name}`,
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
        invalidatesTags: ['QueryTemplate'],
      }),
      updateQueryTemplate: build.mutation<UpdateQueryTemplateApiResponse, UpdateQueryTemplateApiArg>({
        query: (queryArg) => ({
          url: `/querytemplates/${queryArg.name}`,
          method: 'PATCH',
          body: queryArg.patch,
          params: {
            pretty: queryArg.pretty,
            dryRun: queryArg.dryRun,
            fieldManager: queryArg.fieldManager,
            fieldValidation: queryArg.fieldValidation,
            force: queryArg.force,
          },
        }),
        invalidatesTags: ['QueryTemplate'],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as generatedQueryLibraryApi };
export type ListQueryTemplateApiResponse = /** status 200 undefined */ QueryTemplateList;
export type ListQueryTemplateApiArg = {
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
export type CreateQueryTemplateApiResponse = /** status 200 undefined */
  | QueryTemplate
  | /** status 201 undefined */ QueryTemplate
  | /** status 202 undefined */ QueryTemplate;
export type CreateQueryTemplateApiArg = {
  pretty?: string;
  dryRun?: string;
  fieldManager?: string;
  fieldValidation?: string;
  queryTemplate: QueryTemplate;
};
export type DeleteQueryTemplateApiResponse = /** status 200 undefined */ Status | /** status 202 undefined */ Status;
export type DeleteQueryTemplateApiArg = {
  name: string;
  pretty?: string;
  dryRun?: string;
  gracePeriodSeconds?: number;
  ignoreStoreReadErrorWithClusterBreakingPotential?: boolean;
  orphanDependents?: boolean;
  propagationPolicy?: string;
  deleteOptions: DeleteOptions;
};
export type UpdateQueryTemplateApiResponse = /** status 200 undefined */
  | QueryTemplate
  | /** status 201 undefined */ QueryTemplate;
export type UpdateQueryTemplateApiArg = {
  name: string;
  pretty?: string;
  dryRun?: string;
  fieldManager?: string;
  fieldValidation?: string;
  force?: boolean;
  patch: Patch;
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
export type DataQuery = {
  datasource?: {
    apiVersion?: string;
    type: string;
    uid?: string;
  };
  hide?: boolean;
  intervalMs?: number;
  maxDataPoints?: number;
  queryType?: string;
  refId?: string;
  resultAssertions?: {
    maxFrames?: number;
    type?:
      | ''
      | 'timeseries-wide'
      | 'timeseries-long'
      | 'timeseries-many'
      | 'timeseries-multi'
      | 'directory-listing'
      | 'table'
      | 'numeric-wide'
      | 'numeric-multi'
      | 'numeric-long'
      | 'log-lines';
    typeVersion: number[];
  };
  timeRange?: {
    from: string;
    to: string;
  };
  [key: string]: any;
};
export type TemplatePosition = {
  end: number;
  start: number;
};
export type TemplateVariableReplacement = {
  format?: 'csv' | 'doublequote' | 'json' | 'pipe' | 'raw' | 'singlequote';
  path: string;
  position?: TemplatePosition;
};
export type TemplateTarget = {
  dataType?: string;
  properties: DataQuery;
  variables: {
    [key: string]: TemplateVariableReplacement[];
  };
};
export type Unstructured = {
  [key: string]: any;
};
export type TemplateTemplateVariable = {
  defaultValues?: string[];
  key: string;
  valueListDefinition?: Unstructured;
};
export type TemplateQueryTemplate = {
  targets: TemplateTarget[];
  title?: string;
  vars?: TemplateTemplateVariable[];
};
export type QueryTemplate = {
  apiVersion?: string;
  kind?: string;
  metadata?: ObjectMeta;
  spec?: TemplateQueryTemplate;
};
export type ListMeta = {
  continue?: string;
  remainingItemCount?: number;
  resourceVersion?: string;
  selfLink?: string;
};
export type QueryTemplateList = {
  apiVersion?: string;
  items?: QueryTemplate[];
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
export type Patch = object;
