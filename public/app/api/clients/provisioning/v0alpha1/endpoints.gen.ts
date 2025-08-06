import { api } from './baseAPI';
export const addTagTypes = ['Job', 'Repository', 'Provisioning'] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      listJob: build.query<ListJobApiResponse, ListJobApiArg>({
        query: (queryArg) => ({
          url: `/jobs`,
          params: {
            allowWatchBookmarks: queryArg.allowWatchBookmarks,
            continue: queryArg['continue'],
            fieldSelector: queryArg.fieldSelector,
            labelSelector: queryArg.labelSelector,
            limit: queryArg.limit,
            pretty: queryArg.pretty,
            resourceVersion: queryArg.resourceVersion,
            resourceVersionMatch: queryArg.resourceVersionMatch,
            sendInitialEvents: queryArg.sendInitialEvents,
            timeoutSeconds: queryArg.timeoutSeconds,
            watch: queryArg.watch,
          },
        }),
        providesTags: ['Job'],
      }),
      getJob: build.query<GetJobApiResponse, GetJobApiArg>({
        query: (queryArg) => ({
          url: `/jobs/${queryArg.name}`,
          params: {
            pretty: queryArg.pretty,
          },
        }),
        providesTags: ['Job'],
      }),
      listRepository: build.query<ListRepositoryApiResponse, ListRepositoryApiArg>({
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
      createRepository: build.mutation<CreateRepositoryApiResponse, CreateRepositoryApiArg>({
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
      deletecollectionRepository: build.mutation<
        DeletecollectionRepositoryApiResponse,
        DeletecollectionRepositoryApiArg
      >({
        query: (queryArg) => ({
          url: `/repositories`,
          method: 'DELETE',
          params: {
            pretty: queryArg.pretty,
            continue: queryArg['continue'],
            dryRun: queryArg.dryRun,
            fieldSelector: queryArg.fieldSelector,
            gracePeriodSeconds: queryArg.gracePeriodSeconds,
            ignoreStoreReadErrorWithClusterBreakingPotential: queryArg.ignoreStoreReadErrorWithClusterBreakingPotential,
            labelSelector: queryArg.labelSelector,
            limit: queryArg.limit,
            orphanDependents: queryArg.orphanDependents,
            propagationPolicy: queryArg.propagationPolicy,
            resourceVersion: queryArg.resourceVersion,
            resourceVersionMatch: queryArg.resourceVersionMatch,
            sendInitialEvents: queryArg.sendInitialEvents,
            timeoutSeconds: queryArg.timeoutSeconds,
          },
        }),
        invalidatesTags: ['Repository'],
      }),
      getRepository: build.query<GetRepositoryApiResponse, GetRepositoryApiArg>({
        query: (queryArg) => ({
          url: `/repositories/${queryArg.name}`,
          params: {
            pretty: queryArg.pretty,
          },
        }),
        providesTags: ['Repository'],
      }),
      replaceRepository: build.mutation<ReplaceRepositoryApiResponse, ReplaceRepositoryApiArg>({
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
      deleteRepository: build.mutation<DeleteRepositoryApiResponse, DeleteRepositoryApiArg>({
        query: (queryArg) => ({
          url: `/repositories/${queryArg.name}`,
          method: 'DELETE',
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
      getRepositoryFiles: build.query<GetRepositoryFilesApiResponse, GetRepositoryFilesApiArg>({
        query: (queryArg) => ({
          url: `/repositories/${queryArg.name}/files/`,
          params: {
            ref: queryArg.ref,
          },
        }),
        providesTags: ['Repository'],
      }),
      getRepositoryFilesWithPath: build.query<GetRepositoryFilesWithPathApiResponse, GetRepositoryFilesWithPathApiArg>({
        query: (queryArg) => ({
          url: `/repositories/${queryArg.name}/files/${queryArg.path}`,
          params: {
            ref: queryArg.ref,
          },
        }),
        providesTags: ['Repository'],
      }),
      replaceRepositoryFilesWithPath: build.mutation<
        ReplaceRepositoryFilesWithPathApiResponse,
        ReplaceRepositoryFilesWithPathApiArg
      >({
        query: (queryArg) => ({
          url: `/repositories/${queryArg.name}/files/${queryArg.path}`,
          method: 'PUT',
          body: queryArg.body,
          params: {
            ref: queryArg.ref,
            message: queryArg.message,
            skipDryRun: queryArg.skipDryRun,
            originalPath: queryArg.originalPath,
          },
        }),
        invalidatesTags: ['Repository'],
      }),
      createRepositoryFilesWithPath: build.mutation<
        CreateRepositoryFilesWithPathApiResponse,
        CreateRepositoryFilesWithPathApiArg
      >({
        query: (queryArg) => ({
          url: `/repositories/${queryArg.name}/files/${queryArg.path}`,
          method: 'POST',
          body: queryArg.body,
          params: {
            ref: queryArg.ref,
            message: queryArg.message,
            skipDryRun: queryArg.skipDryRun,
            originalPath: queryArg.originalPath,
          },
        }),
        invalidatesTags: ['Repository'],
      }),
      deleteRepositoryFilesWithPath: build.mutation<
        DeleteRepositoryFilesWithPathApiResponse,
        DeleteRepositoryFilesWithPathApiArg
      >({
        query: (queryArg) => ({
          url: `/repositories/${queryArg.name}/files/${queryArg.path}`,
          method: 'DELETE',
          params: {
            ref: queryArg.ref,
            message: queryArg.message,
            skipDryRun: queryArg.skipDryRun,
            originalPath: queryArg.originalPath,
          },
        }),
        invalidatesTags: ['Repository'],
      }),
      getRepositoryHistory: build.query<GetRepositoryHistoryApiResponse, GetRepositoryHistoryApiArg>({
        query: (queryArg) => ({
          url: `/repositories/${queryArg.name}/history`,
          params: {
            ref: queryArg.ref,
          },
        }),
        providesTags: ['Repository'],
      }),
      getRepositoryHistoryWithPath: build.query<
        GetRepositoryHistoryWithPathApiResponse,
        GetRepositoryHistoryWithPathApiArg
      >({
        query: (queryArg) => ({
          url: `/repositories/${queryArg.name}/history/${queryArg.path}`,
          params: {
            ref: queryArg.ref,
          },
        }),
        providesTags: ['Repository'],
      }),
      getRepositoryJobs: build.query<GetRepositoryJobsApiResponse, GetRepositoryJobsApiArg>({
        query: (queryArg) => ({ url: `/repositories/${queryArg.name}/jobs` }),
        providesTags: ['Repository'],
      }),
      createRepositoryJobs: build.mutation<CreateRepositoryJobsApiResponse, CreateRepositoryJobsApiArg>({
        query: (queryArg) => ({ url: `/repositories/${queryArg.name}/jobs`, method: 'POST', body: queryArg.jobSpec }),
        invalidatesTags: ['Repository'],
      }),
      getRepositoryJobsWithPath: build.query<GetRepositoryJobsWithPathApiResponse, GetRepositoryJobsWithPathApiArg>({
        query: (queryArg) => ({ url: `/repositories/${queryArg.name}/jobs/${queryArg.uid}` }),
        providesTags: ['Repository'],
      }),
      getRepositoryRefs: build.query<GetRepositoryRefsApiResponse, GetRepositoryRefsApiArg>({
        query: (queryArg) => ({ url: `/repositories/${queryArg.name}/refs` }),
        providesTags: ['Repository'],
      }),
      getRepositoryRenderWithPath: build.query<
        GetRepositoryRenderWithPathApiResponse,
        GetRepositoryRenderWithPathApiArg
      >({
        query: (queryArg) => ({ url: `/repositories/${queryArg.name}/render/${queryArg.guid}` }),
        providesTags: ['Repository'],
      }),
      getRepositoryResources: build.query<GetRepositoryResourcesApiResponse, GetRepositoryResourcesApiArg>({
        query: (queryArg) => ({ url: `/repositories/${queryArg.name}/resources` }),
        providesTags: ['Repository'],
      }),
      getRepositoryStatus: build.query<GetRepositoryStatusApiResponse, GetRepositoryStatusApiArg>({
        query: (queryArg) => ({
          url: `/repositories/${queryArg.name}/status`,
          params: {
            pretty: queryArg.pretty,
          },
        }),
        providesTags: ['Repository'],
      }),
      replaceRepositoryStatus: build.mutation<ReplaceRepositoryStatusApiResponse, ReplaceRepositoryStatusApiArg>({
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
      createRepositoryTest: build.mutation<CreateRepositoryTestApiResponse, CreateRepositoryTestApiArg>({
        query: (queryArg) => ({ url: `/repositories/${queryArg.name}/test`, method: 'POST', body: queryArg.body }),
        invalidatesTags: ['Repository'],
      }),
      getRepositoryWebhook: build.query<GetRepositoryWebhookApiResponse, GetRepositoryWebhookApiArg>({
        query: (queryArg) => ({ url: `/repositories/${queryArg.name}/webhook` }),
        providesTags: ['Repository'],
      }),
      createRepositoryWebhook: build.mutation<CreateRepositoryWebhookApiResponse, CreateRepositoryWebhookApiArg>({
        query: (queryArg) => ({ url: `/repositories/${queryArg.name}/webhook`, method: 'POST' }),
        invalidatesTags: ['Repository'],
      }),
      getFrontendSettings: build.query<GetFrontendSettingsApiResponse, GetFrontendSettingsApiArg>({
        query: () => ({ url: `/settings` }),
        providesTags: ['Provisioning', 'Repository'],
      }),
      getResourceStats: build.query<GetResourceStatsApiResponse, GetResourceStatsApiArg>({
        query: () => ({ url: `/stats` }),
        providesTags: ['Provisioning', 'Repository'],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as generatedAPI };
export type ListJobApiResponse = /** status 200 OK */ JobList;
export type ListJobApiArg = {
  /** allowWatchBookmarks requests watch events with type "BOOKMARK". Servers that do not implement bookmarks may ignore this flag and bookmarks are sent at the server's discretion. Clients should not assume bookmarks are returned at any specific interval, nor may they assume the server will send any BOOKMARK event during a session. If this is not a watch, this field is ignored. */
  allowWatchBookmarks?: boolean;
  /** The continue option should be set when retrieving more results from the server. Since this value is server defined, clients may only use the continue value from a previous query result with identical query parameters (except for the value of continue) and the server may reject a continue value it does not recognize. If the specified continue value is no longer valid whether due to expiration (generally five to fifteen minutes) or a configuration change on the server, the server will respond with a 410 ResourceExpired error together with a continue token. If the client needs a consistent list, it must restart their list without the continue field. Otherwise, the client may send another list request with the token received with the 410 error, the server will respond with a list starting from the next key, but from the latest snapshot, which is inconsistent from the previous list results - objects that are created, modified, or deleted after the first list request will be included in the response, as long as their keys are after the "next key".
    
    This field is not supported when watch is true. Clients may start a watch from the last resourceVersion value returned by the server and not miss any modifications. */
  continue?: string;
  /** A selector to restrict the list of returned objects by their fields. Defaults to everything. */
  fieldSelector?: string;
  /** A selector to restrict the list of returned objects by their labels. Defaults to everything. */
  labelSelector?: string;
  /** limit is a maximum number of responses to return for a list call. If more items exist, the server will set the `continue` field on the list metadata to a value that can be used with the same initial query to retrieve the next set of results. Setting a limit may return fewer than the requested amount of items (up to zero items) in the event all requested objects are filtered out and clients should only use the presence of the continue field to determine whether more results are available. Servers may choose not to support the limit argument and will return all of the available results. If limit is specified and the continue field is empty, clients may assume that no more results are available. This field is not supported if watch is true.
    
    The server guarantees that the objects returned when using continue will be identical to issuing a single list call without a limit - that is, no objects created, modified, or deleted after the first request is issued will be included in any subsequent continued requests. This is sometimes referred to as a consistent snapshot, and ensures that a client that is using limit to receive smaller chunks of a very large result can ensure they see all possible objects. If objects are updated during a chunked list the version of the object that was present at the time the first list result was calculated is returned. */
  limit?: number;
  /** If 'true', then the output is pretty printed. Defaults to 'false' unless the user-agent indicates a browser or command-line HTTP tool (curl and wget). */
  pretty?: string;
  /** resourceVersion sets a constraint on what resource versions a request may be served from. See https://kubernetes.io/docs/reference/using-api/api-concepts/#resource-versions for details.
    
    Defaults to unset */
  resourceVersion?: string;
  /** resourceVersionMatch determines how resourceVersion is applied to list calls. It is highly recommended that resourceVersionMatch be set for list calls where resourceVersion is set See https://kubernetes.io/docs/reference/using-api/api-concepts/#resource-versions for details.
    
    Defaults to unset */
  resourceVersionMatch?: string;
  /** `sendInitialEvents=true` may be set together with `watch=true`. In that case, the watch stream will begin with synthetic events to produce the current state of objects in the collection. Once all such events have been sent, a synthetic "Bookmark" event  will be sent. The bookmark will report the ResourceVersion (RV) corresponding to the set of objects, and be marked with `"k8s.io/initial-events-end": "true"` annotation. Afterwards, the watch stream will proceed as usual, sending watch events corresponding to changes (subsequent to the RV) to objects watched.
    
    When `sendInitialEvents` option is set, we require `resourceVersionMatch` option to also be set. The semantic of the watch request is as following: - `resourceVersionMatch` = NotOlderThan
      is interpreted as "data at least as new as the provided `resourceVersion`"
      and the bookmark event is send when the state is synced
      to a `resourceVersion` at least as fresh as the one provided by the ListOptions.
      If `resourceVersion` is unset, this is interpreted as "consistent read" and the
      bookmark event is send when the state is synced at least to the moment
      when request started being processed.
    - `resourceVersionMatch` set to any other value or unset
      Invalid error is returned.
    
    Defaults to true if `resourceVersion=""` or `resourceVersion="0"` (for backward compatibility reasons) and to false otherwise. */
  sendInitialEvents?: boolean;
  /** Timeout for the list/watch call. This limits the duration of the call, regardless of any activity or inactivity. */
  timeoutSeconds?: number;
  /** Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion. */
  watch?: boolean;
};
export type GetJobApiResponse = /** status 200 OK */ Job;
export type GetJobApiArg = {
  /** name of the Job */
  name: string;
  /** If 'true', then the output is pretty printed. Defaults to 'false' unless the user-agent indicates a browser or command-line HTTP tool (curl and wget). */
  pretty?: string;
};
export type ListRepositoryApiResponse = /** status 200 OK */ RepositoryList;
export type ListRepositoryApiArg = {
  /** If 'true', then the output is pretty printed. Defaults to 'false' unless the user-agent indicates a browser or command-line HTTP tool (curl and wget). */
  pretty?: string;
  /** allowWatchBookmarks requests watch events with type "BOOKMARK". Servers that do not implement bookmarks may ignore this flag and bookmarks are sent at the server's discretion. Clients should not assume bookmarks are returned at any specific interval, nor may they assume the server will send any BOOKMARK event during a session. If this is not a watch, this field is ignored. */
  allowWatchBookmarks?: boolean;
  /** The continue option should be set when retrieving more results from the server. Since this value is server defined, clients may only use the continue value from a previous query result with identical query parameters (except for the value of continue) and the server may reject a continue value it does not recognize. If the specified continue value is no longer valid whether due to expiration (generally five to fifteen minutes) or a configuration change on the server, the server will respond with a 410 ResourceExpired error together with a continue token. If the client needs a consistent list, it must restart their list without the continue field. Otherwise, the client may send another list request with the token received with the 410 error, the server will respond with a list starting from the next key, but from the latest snapshot, which is inconsistent from the previous list results - objects that are created, modified, or deleted after the first list request will be included in the response, as long as their keys are after the "next key".
    
    This field is not supported when watch is true. Clients may start a watch from the last resourceVersion value returned by the server and not miss any modifications. */
  continue?: string;
  /** A selector to restrict the list of returned objects by their fields. Defaults to everything. */
  fieldSelector?: string;
  /** A selector to restrict the list of returned objects by their labels. Defaults to everything. */
  labelSelector?: string;
  /** limit is a maximum number of responses to return for a list call. If more items exist, the server will set the `continue` field on the list metadata to a value that can be used with the same initial query to retrieve the next set of results. Setting a limit may return fewer than the requested amount of items (up to zero items) in the event all requested objects are filtered out and clients should only use the presence of the continue field to determine whether more results are available. Servers may choose not to support the limit argument and will return all of the available results. If limit is specified and the continue field is empty, clients may assume that no more results are available. This field is not supported if watch is true.
    
    The server guarantees that the objects returned when using continue will be identical to issuing a single list call without a limit - that is, no objects created, modified, or deleted after the first request is issued will be included in any subsequent continued requests. This is sometimes referred to as a consistent snapshot, and ensures that a client that is using limit to receive smaller chunks of a very large result can ensure they see all possible objects. If objects are updated during a chunked list the version of the object that was present at the time the first list result was calculated is returned. */
  limit?: number;
  /** resourceVersion sets a constraint on what resource versions a request may be served from. See https://kubernetes.io/docs/reference/using-api/api-concepts/#resource-versions for details.
    
    Defaults to unset */
  resourceVersion?: string;
  /** resourceVersionMatch determines how resourceVersion is applied to list calls. It is highly recommended that resourceVersionMatch be set for list calls where resourceVersion is set See https://kubernetes.io/docs/reference/using-api/api-concepts/#resource-versions for details.
    
    Defaults to unset */
  resourceVersionMatch?: string;
  /** `sendInitialEvents=true` may be set together with `watch=true`. In that case, the watch stream will begin with synthetic events to produce the current state of objects in the collection. Once all such events have been sent, a synthetic "Bookmark" event  will be sent. The bookmark will report the ResourceVersion (RV) corresponding to the set of objects, and be marked with `"k8s.io/initial-events-end": "true"` annotation. Afterwards, the watch stream will proceed as usual, sending watch events corresponding to changes (subsequent to the RV) to objects watched.
    
    When `sendInitialEvents` option is set, we require `resourceVersionMatch` option to also be set. The semantic of the watch request is as following: - `resourceVersionMatch` = NotOlderThan
      is interpreted as "data at least as new as the provided `resourceVersion`"
      and the bookmark event is send when the state is synced
      to a `resourceVersion` at least as fresh as the one provided by the ListOptions.
      If `resourceVersion` is unset, this is interpreted as "consistent read" and the
      bookmark event is send when the state is synced at least to the moment
      when request started being processed.
    - `resourceVersionMatch` set to any other value or unset
      Invalid error is returned.
    
    Defaults to true if `resourceVersion=""` or `resourceVersion="0"` (for backward compatibility reasons) and to false otherwise. */
  sendInitialEvents?: boolean;
  /** Timeout for the list/watch call. This limits the duration of the call, regardless of any activity or inactivity. */
  timeoutSeconds?: number;
  /** Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion. */
  watch?: boolean;
};
export type CreateRepositoryApiResponse = /** status 200 OK */
  | Repository
  | /** status 201 Created */ Repository
  | /** status 202 Accepted */ Repository;
export type CreateRepositoryApiArg = {
  /** If 'true', then the output is pretty printed. Defaults to 'false' unless the user-agent indicates a browser or command-line HTTP tool (curl and wget). */
  pretty?: string;
  /** When present, indicates that modifications should not be persisted. An invalid or unrecognized dryRun directive will result in an error response and no further processing of the request. Valid values are: - All: all dry run stages will be processed */
  dryRun?: string;
  /** fieldManager is a name associated with the actor or entity that is making these changes. The value must be less than or 128 characters long, and only contain printable characters, as defined by https://golang.org/pkg/unicode/#IsPrint. */
  fieldManager?: string;
  /** fieldValidation instructs the server on how to handle objects in the request (POST/PUT/PATCH) containing unknown or duplicate fields. Valid values are: - Ignore: This will ignore any unknown fields that are silently dropped from the object, and will ignore all but the last duplicate field that the decoder encounters. This is the default behavior prior to v1.23. - Warn: This will send a warning via the standard warning response header for each unknown field that is dropped from the object, and for each duplicate field that is encountered. The request will still succeed if there are no other errors, and will only persist the last of any duplicate fields. This is the default in v1.23+ - Strict: This will fail the request with a BadRequest error if any unknown fields would be dropped from the object, or if any duplicate fields are present. The error returned from the server will contain all unknown and duplicate fields encountered. */
  fieldValidation?: string;
  repository: Repository;
};
export type DeletecollectionRepositoryApiResponse = /** status 200 OK */ Status;
export type DeletecollectionRepositoryApiArg = {
  /** If 'true', then the output is pretty printed. Defaults to 'false' unless the user-agent indicates a browser or command-line HTTP tool (curl and wget). */
  pretty?: string;
  /** The continue option should be set when retrieving more results from the server. Since this value is server defined, clients may only use the continue value from a previous query result with identical query parameters (except for the value of continue) and the server may reject a continue value it does not recognize. If the specified continue value is no longer valid whether due to expiration (generally five to fifteen minutes) or a configuration change on the server, the server will respond with a 410 ResourceExpired error together with a continue token. If the client needs a consistent list, it must restart their list without the continue field. Otherwise, the client may send another list request with the token received with the 410 error, the server will respond with a list starting from the next key, but from the latest snapshot, which is inconsistent from the previous list results - objects that are created, modified, or deleted after the first list request will be included in the response, as long as their keys are after the "next key".
    
    This field is not supported when watch is true. Clients may start a watch from the last resourceVersion value returned by the server and not miss any modifications. */
  continue?: string;
  /** When present, indicates that modifications should not be persisted. An invalid or unrecognized dryRun directive will result in an error response and no further processing of the request. Valid values are: - All: all dry run stages will be processed */
  dryRun?: string;
  /** A selector to restrict the list of returned objects by their fields. Defaults to everything. */
  fieldSelector?: string;
  /** The duration in seconds before the object should be deleted. Value must be non-negative integer. The value zero indicates delete immediately. If this value is nil, the default grace period for the specified type will be used. Defaults to a per object value if not specified. zero means delete immediately. */
  gracePeriodSeconds?: number;
  /** if set to true, it will trigger an unsafe deletion of the resource in case the normal deletion flow fails with a corrupt object error. A resource is considered corrupt if it can not be retrieved from the underlying storage successfully because of a) its data can not be transformed e.g. decryption failure, or b) it fails to decode into an object. NOTE: unsafe deletion ignores finalizer constraints, skips precondition checks, and removes the object from the storage. WARNING: This may potentially break the cluster if the workload associated with the resource being unsafe-deleted relies on normal deletion flow. Use only if you REALLY know what you are doing. The default value is false, and the user must opt in to enable it */
  ignoreStoreReadErrorWithClusterBreakingPotential?: boolean;
  /** A selector to restrict the list of returned objects by their labels. Defaults to everything. */
  labelSelector?: string;
  /** limit is a maximum number of responses to return for a list call. If more items exist, the server will set the `continue` field on the list metadata to a value that can be used with the same initial query to retrieve the next set of results. Setting a limit may return fewer than the requested amount of items (up to zero items) in the event all requested objects are filtered out and clients should only use the presence of the continue field to determine whether more results are available. Servers may choose not to support the limit argument and will return all of the available results. If limit is specified and the continue field is empty, clients may assume that no more results are available. This field is not supported if watch is true.
    
    The server guarantees that the objects returned when using continue will be identical to issuing a single list call without a limit - that is, no objects created, modified, or deleted after the first request is issued will be included in any subsequent continued requests. This is sometimes referred to as a consistent snapshot, and ensures that a client that is using limit to receive smaller chunks of a very large result can ensure they see all possible objects. If objects are updated during a chunked list the version of the object that was present at the time the first list result was calculated is returned. */
  limit?: number;
  /** Deprecated: please use the PropagationPolicy, this field will be deprecated in 1.7. Should the dependent objects be orphaned. If true/false, the "orphan" finalizer will be added to/removed from the object's finalizers list. Either this field or PropagationPolicy may be set, but not both. */
  orphanDependents?: boolean;
  /** Whether and how garbage collection will be performed. Either this field or OrphanDependents may be set, but not both. The default policy is decided by the existing finalizer set in the metadata.finalizers and the resource-specific default policy. Acceptable values are: 'Orphan' - orphan the dependents; 'Background' - allow the garbage collector to delete the dependents in the background; 'Foreground' - a cascading policy that deletes all dependents in the foreground. */
  propagationPolicy?: string;
  /** resourceVersion sets a constraint on what resource versions a request may be served from. See https://kubernetes.io/docs/reference/using-api/api-concepts/#resource-versions for details.
    
    Defaults to unset */
  resourceVersion?: string;
  /** resourceVersionMatch determines how resourceVersion is applied to list calls. It is highly recommended that resourceVersionMatch be set for list calls where resourceVersion is set See https://kubernetes.io/docs/reference/using-api/api-concepts/#resource-versions for details.
    
    Defaults to unset */
  resourceVersionMatch?: string;
  /** `sendInitialEvents=true` may be set together with `watch=true`. In that case, the watch stream will begin with synthetic events to produce the current state of objects in the collection. Once all such events have been sent, a synthetic "Bookmark" event  will be sent. The bookmark will report the ResourceVersion (RV) corresponding to the set of objects, and be marked with `"k8s.io/initial-events-end": "true"` annotation. Afterwards, the watch stream will proceed as usual, sending watch events corresponding to changes (subsequent to the RV) to objects watched.
    
    When `sendInitialEvents` option is set, we require `resourceVersionMatch` option to also be set. The semantic of the watch request is as following: - `resourceVersionMatch` = NotOlderThan
      is interpreted as "data at least as new as the provided `resourceVersion`"
      and the bookmark event is send when the state is synced
      to a `resourceVersion` at least as fresh as the one provided by the ListOptions.
      If `resourceVersion` is unset, this is interpreted as "consistent read" and the
      bookmark event is send when the state is synced at least to the moment
      when request started being processed.
    - `resourceVersionMatch` set to any other value or unset
      Invalid error is returned.
    
    Defaults to true if `resourceVersion=""` or `resourceVersion="0"` (for backward compatibility reasons) and to false otherwise. */
  sendInitialEvents?: boolean;
  /** Timeout for the list/watch call. This limits the duration of the call, regardless of any activity or inactivity. */
  timeoutSeconds?: number;
};
export type GetRepositoryApiResponse = /** status 200 OK */ Repository;
export type GetRepositoryApiArg = {
  /** name of the Repository */
  name: string;
  /** If 'true', then the output is pretty printed. Defaults to 'false' unless the user-agent indicates a browser or command-line HTTP tool (curl and wget). */
  pretty?: string;
};
export type ReplaceRepositoryApiResponse = /** status 200 OK */ Repository | /** status 201 Created */ Repository;
export type ReplaceRepositoryApiArg = {
  /** name of the Repository */
  name: string;
  /** If 'true', then the output is pretty printed. Defaults to 'false' unless the user-agent indicates a browser or command-line HTTP tool (curl and wget). */
  pretty?: string;
  /** When present, indicates that modifications should not be persisted. An invalid or unrecognized dryRun directive will result in an error response and no further processing of the request. Valid values are: - All: all dry run stages will be processed */
  dryRun?: string;
  /** fieldManager is a name associated with the actor or entity that is making these changes. The value must be less than or 128 characters long, and only contain printable characters, as defined by https://golang.org/pkg/unicode/#IsPrint. */
  fieldManager?: string;
  /** fieldValidation instructs the server on how to handle objects in the request (POST/PUT/PATCH) containing unknown or duplicate fields. Valid values are: - Ignore: This will ignore any unknown fields that are silently dropped from the object, and will ignore all but the last duplicate field that the decoder encounters. This is the default behavior prior to v1.23. - Warn: This will send a warning via the standard warning response header for each unknown field that is dropped from the object, and for each duplicate field that is encountered. The request will still succeed if there are no other errors, and will only persist the last of any duplicate fields. This is the default in v1.23+ - Strict: This will fail the request with a BadRequest error if any unknown fields would be dropped from the object, or if any duplicate fields are present. The error returned from the server will contain all unknown and duplicate fields encountered. */
  fieldValidation?: string;
  repository: Repository;
};
export type DeleteRepositoryApiResponse = /** status 200 OK */ Status | /** status 202 Accepted */ Status;
export type DeleteRepositoryApiArg = {
  /** name of the Repository */
  name: string;
  /** If 'true', then the output is pretty printed. Defaults to 'false' unless the user-agent indicates a browser or command-line HTTP tool (curl and wget). */
  pretty?: string;
  /** When present, indicates that modifications should not be persisted. An invalid or unrecognized dryRun directive will result in an error response and no further processing of the request. Valid values are: - All: all dry run stages will be processed */
  dryRun?: string;
  /** The duration in seconds before the object should be deleted. Value must be non-negative integer. The value zero indicates delete immediately. If this value is nil, the default grace period for the specified type will be used. Defaults to a per object value if not specified. zero means delete immediately. */
  gracePeriodSeconds?: number;
  /** if set to true, it will trigger an unsafe deletion of the resource in case the normal deletion flow fails with a corrupt object error. A resource is considered corrupt if it can not be retrieved from the underlying storage successfully because of a) its data can not be transformed e.g. decryption failure, or b) it fails to decode into an object. NOTE: unsafe deletion ignores finalizer constraints, skips precondition checks, and removes the object from the storage. WARNING: This may potentially break the cluster if the workload associated with the resource being unsafe-deleted relies on normal deletion flow. Use only if you REALLY know what you are doing. The default value is false, and the user must opt in to enable it */
  ignoreStoreReadErrorWithClusterBreakingPotential?: boolean;
  /** Deprecated: please use the PropagationPolicy, this field will be deprecated in 1.7. Should the dependent objects be orphaned. If true/false, the "orphan" finalizer will be added to/removed from the object's finalizers list. Either this field or PropagationPolicy may be set, but not both. */
  orphanDependents?: boolean;
  /** Whether and how garbage collection will be performed. Either this field or OrphanDependents may be set, but not both. The default policy is decided by the existing finalizer set in the metadata.finalizers and the resource-specific default policy. Acceptable values are: 'Orphan' - orphan the dependents; 'Background' - allow the garbage collector to delete the dependents in the background; 'Foreground' - a cascading policy that deletes all dependents in the foreground. */
  propagationPolicy?: string;
};
export type GetRepositoryFilesApiResponse = /** status 200 OK */ {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  items: any[];
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  metadata?: any;
};
export type GetRepositoryFilesApiArg = {
  /** name of the ResourceWrapper */
  name: string;
  /** branch or commit hash */
  ref?: string;
};
export type GetRepositoryFilesWithPathApiResponse = /** status 200 OK */ ResourceWrapper;
export type GetRepositoryFilesWithPathApiArg = {
  /** name of the ResourceWrapper */
  name: string;
  /** path to the resource */
  path: string;
  /** branch or commit hash */
  ref?: string;
};
export type ReplaceRepositoryFilesWithPathApiResponse = /** status 200 OK */ ResourceWrapper;
export type ReplaceRepositoryFilesWithPathApiArg = {
  /** name of the ResourceWrapper */
  name: string;
  /** path to the resource */
  path: string;
  /** branch or commit hash */
  ref?: string;
  /** optional message sent with any changes */
  message?: string;
  /** do not pro-actively verify the payload */
  skipDryRun?: boolean;
  /** path of file to move (used with POST method for move operations). Must be same type as target path: file-to-file (e.g., 'some/a.json' -> 'c/d.json') or folder-to-folder (e.g., 'some/' -> 'new/') */
  originalPath?: string;
  body: {
    [key: string]: any;
  };
};
export type CreateRepositoryFilesWithPathApiResponse = /** status 200 OK */ ResourceWrapper;
export type CreateRepositoryFilesWithPathApiArg = {
  /** name of the ResourceWrapper */
  name: string;
  /** path to the resource */
  path: string;
  /** branch or commit hash */
  ref?: string;
  /** optional message sent with any changes */
  message?: string;
  /** do not pro-actively verify the payload */
  skipDryRun?: boolean;
  /** path of file to move (used with POST method for move operations). Must be same type as target path: file-to-file (e.g., 'some/a.json' -> 'c/d.json') or folder-to-folder (e.g., 'some/' -> 'new/') */
  originalPath?: string;
  body: {
    [key: string]: any;
  };
};
export type DeleteRepositoryFilesWithPathApiResponse = /** status 200 OK */ ResourceWrapper;
export type DeleteRepositoryFilesWithPathApiArg = {
  /** name of the ResourceWrapper */
  name: string;
  /** path to the resource */
  path: string;
  /** branch or commit hash */
  ref?: string;
  /** optional message sent with any changes */
  message?: string;
  /** do not pro-actively verify the payload */
  skipDryRun?: boolean;
  /** path of file to move (used with POST method for move operations). Must be same type as target path: file-to-file (e.g., 'some/a.json' -> 'c/d.json') or folder-to-folder (e.g., 'some/' -> 'new/') */
  originalPath?: string;
};
export type GetRepositoryHistoryApiResponse = /** status 200 OK */ string;
export type GetRepositoryHistoryApiArg = {
  /** name of the HistoryList */
  name: string;
  /** branch or commit hash */
  ref?: string;
};
export type GetRepositoryHistoryWithPathApiResponse = /** status 200 OK */ string;
export type GetRepositoryHistoryWithPathApiArg = {
  /** name of the HistoryList */
  name: string;
  /** path to the resource */
  path: string;
  /** branch or commit hash */
  ref?: string;
};
export type GetRepositoryJobsApiResponse = /** status 200 OK */ JobList;
export type GetRepositoryJobsApiArg = {
  /** name of the Repository */
  name: string;
};
export type CreateRepositoryJobsApiResponse = /** status 200 OK */ Job;
export type CreateRepositoryJobsApiArg = {
  /** name of the Repository */
  name: string;
  jobSpec: JobSpec;
};
export type GetRepositoryJobsWithPathApiResponse = /** status 200 OK */ Job;
export type GetRepositoryJobsWithPathApiArg = {
  /** name of the Repository */
  name: string;
  /** Original Job UID */
  uid: string;
};
export type GetRepositoryRefsApiResponse = /** status 200 OK */ {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  items: any[];
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  metadata?: any;
};
export type GetRepositoryRefsApiArg = {
  /** name of the RefList */
  name: string;
};
export type GetRepositoryRenderWithPathApiResponse = unknown;
export type GetRepositoryRenderWithPathApiArg = {
  /** name of the Repository */
  name: string;
  /** Image GUID */
  guid: string;
};
export type GetRepositoryResourcesApiResponse = /** status 200 OK */ ResourceList;
export type GetRepositoryResourcesApiArg = {
  /** name of the ResourceList */
  name: string;
};
export type GetRepositoryStatusApiResponse = /** status 200 OK */ Repository;
export type GetRepositoryStatusApiArg = {
  /** name of the Repository */
  name: string;
  /** If 'true', then the output is pretty printed. Defaults to 'false' unless the user-agent indicates a browser or command-line HTTP tool (curl and wget). */
  pretty?: string;
};
export type ReplaceRepositoryStatusApiResponse = /** status 200 OK */ Repository | /** status 201 Created */ Repository;
export type ReplaceRepositoryStatusApiArg = {
  /** name of the Repository */
  name: string;
  /** If 'true', then the output is pretty printed. Defaults to 'false' unless the user-agent indicates a browser or command-line HTTP tool (curl and wget). */
  pretty?: string;
  /** When present, indicates that modifications should not be persisted. An invalid or unrecognized dryRun directive will result in an error response and no further processing of the request. Valid values are: - All: all dry run stages will be processed */
  dryRun?: string;
  /** fieldManager is a name associated with the actor or entity that is making these changes. The value must be less than or 128 characters long, and only contain printable characters, as defined by https://golang.org/pkg/unicode/#IsPrint. */
  fieldManager?: string;
  /** fieldValidation instructs the server on how to handle objects in the request (POST/PUT/PATCH) containing unknown or duplicate fields. Valid values are: - Ignore: This will ignore any unknown fields that are silently dropped from the object, and will ignore all but the last duplicate field that the decoder encounters. This is the default behavior prior to v1.23. - Warn: This will send a warning via the standard warning response header for each unknown field that is dropped from the object, and for each duplicate field that is encountered. The request will still succeed if there are no other errors, and will only persist the last of any duplicate fields. This is the default in v1.23+ - Strict: This will fail the request with a BadRequest error if any unknown fields would be dropped from the object, or if any duplicate fields are present. The error returned from the server will contain all unknown and duplicate fields encountered. */
  fieldValidation?: string;
  repository: Repository;
};
export type CreateRepositoryTestApiResponse = /** status 200 OK */ TestResults;
export type CreateRepositoryTestApiArg = {
  /** name of the TestResults */
  name: string;
  body: {
    /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
    apiVersion?: string;
    /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
    kind?: string;
    metadata?: any;
    spec?: any;
    status?: any;
  };
};
export type GetRepositoryWebhookApiResponse = /** status 200 OK */ WebhookResponse;
export type GetRepositoryWebhookApiArg = {
  /** name of the WebhookResponse */
  name: string;
};
export type CreateRepositoryWebhookApiResponse = /** status 200 OK */ WebhookResponse;
export type CreateRepositoryWebhookApiArg = {
  /** name of the WebhookResponse */
  name: string;
};
export type GetFrontendSettingsApiResponse = /** status 200 undefined */ RepositoryViewList;
export type GetFrontendSettingsApiArg = void;
export type GetResourceStatsApiResponse = /** status 200 undefined */ ResourceStats;
export type GetResourceStatsApiArg = void;
export type JobList = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  items: any[];
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  metadata?: any;
};
export type Job = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  metadata?: any;
  spec?: any;
  status?: any;
};
export type RepositoryList = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  items: any[];
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  metadata?: any;
};
export type Repository = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  metadata?: any;
  spec?: any;
  status?: any;
};
export type StatusCause = {
  /** The field of the resource that has caused this error, as named by its JSON serialization. May include dot and postfix notation for nested attributes. Arrays are zero-indexed.  Fields may appear more than once in an array of causes due to fields having multiple errors. Optional.
    
    Examples:
      "name" - the field "name" on the current resource
      "items[0].name" - the field "name" on the first array entry in "items" */
  field?: string;
  /** A human-readable description of the cause of the error.  This field may be presented as-is to a reader. */
  message?: string;
  /** A machine-readable description of the cause of the error. If this value is empty there is no information available. */
  reason?: string;
};
export type StatusDetails = {
  /** The Causes array includes more details associated with the StatusReason failure. Not all StatusReasons may provide detailed causes. */
  causes?: StatusCause[];
  /** The group attribute of the resource associated with the status StatusReason. */
  group?: string;
  /** The kind attribute of the resource associated with the status StatusReason. On some operations may differ from the requested resource Kind. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  /** The name attribute of the resource associated with the status StatusReason (when there is a single name which can be described). */
  name?: string;
  /** If specified, the time in seconds before the operation should be retried. Some errors may indicate the client must take an alternate action - for those errors this field may indicate how long to wait before taking the alternate action. */
  retryAfterSeconds?: number;
  /** UID of the resource. (when there is a single resource which can be described). More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#uids */
  uid?: string;
};
export type ListMeta = {
  /** continue may be set if the user set a limit on the number of items returned, and indicates that the server has more data available. The value is opaque and may be used to issue another request to the endpoint that served this list to retrieve the next set of available objects. Continuing a consistent list may not be possible if the server configuration has changed or more than a few minutes have passed. The resourceVersion field returned when using this continue value will be identical to the value in the first response, unless you have received this token from an error message. */
  continue?: string;
  /** remainingItemCount is the number of subsequent items in the list which are not included in this list response. If the list request contained label or field selectors, then the number of remaining items is unknown and the field will be left unset and omitted during serialization. If the list is complete (either because it is not chunking or because this is the last chunk), then there are no more remaining items and this field will be left unset and omitted during serialization. Servers older than v1.15 do not set this field. The intended use of the remainingItemCount is *estimating* the size of a collection. Clients should not rely on the remainingItemCount to be set or to be exact. */
  remainingItemCount?: number;
  /** String that identifies the server's internal version of this object that can be used by clients to determine when objects have changed. Value must be treated as opaque by clients and passed unmodified back to the server. Populated by the system. Read-only. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency */
  resourceVersion?: string;
  /** Deprecated: selfLink is a legacy read-only field that is no longer populated by the system. */
  selfLink?: string;
};
export type Status = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  /** Suggested HTTP return code for this status, 0 if not set. */
  code?: number;
  /** Extended data associated with the reason.  Each reason may define its own extended details. This field is optional and the data returned is not guaranteed to conform to any schema except that defined by the reason type. */
  details?: StatusDetails;
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  /** A human-readable description of the status of this operation. */
  message?: string;
  /** Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  metadata?: ListMeta;
  /** A machine-readable description of why this operation is in the "Failure" status. If this value is empty there is no information available. A Reason clarifies an HTTP status code but does not override it. */
  reason?: string;
  /** Status of the operation. One of: "Success" or "Failure". More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status */
  status?: string;
};
export type ResourceWrapper = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  /** If errors exist, show them here */
  errors?: string[];
  /** The repo hash value */
  hash?: string;
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  /** Path to the remote file */
  path?: string;
  /** The request ref (or branch if exists) */
  ref?: string;
  /** Basic repository info */
  repository: any;
  /** Different flavors of the same object */
  resource: any;
  /** The modified time in the remote file system */
  timestamp?: any;
  /** Typed links for this file (only supported by external systems, github etc) */
  urls?: any;
};
export type JobSpec = {
  /** Possible enum values:
     - `"delete"` deletes files in the remote repository
     - `"migrate"` acts like JobActionExport, then JobActionPull. It also tries to preserve the history.
     - `"move"` moves files in the remote repository
     - `"pr"` adds additional useful information to a PR, such as comments with preview links and rendered images.
     - `"pull"` replicates the remote branch in the local copy of the repository.
     - `"push"` replicates the local copy of the repository in the remote branch. */
  action?: 'delete' | 'migrate' | 'move' | 'pr' | 'pull' | 'push';
  /** Delete when the action is `delete` */
  delete?: any;
  /** Required when the action is `migrate` */
  migrate?: any;
  /** Move when the action is `move` */
  move?: any;
  /** Pull request options */
  pr?: any;
  /** Required when the action is `pull` */
  pull?: any;
  /** Required when the action is `push` */
  push?: any;
  /** The the repository reference (for now also in labels) This value is required, but will be popuplated from the job making the request */
  repository?: string;
};
export type ResourceList = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  items: any[];
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  metadata?: any;
};
export type TestResults = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  /** HTTP status code */
  code: number;
  /** Field related errors */
  errors?: any[];
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  /** Is the connection healthy */
  success: boolean;
};
export type WebhookResponse = {
  /** Optional message */
  added?: string;
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  /** HTTP Status code 200 implies that the payload was understood but nothing is required 202 implies that an async job has been scheduled to handle the request */
  code?: number;
  /** Jobs to be processed When the response is 202 (Accepted) the queued jobs will be returned */
  job?: any;
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
};
export type RepositoryView = {
  /** For git, this is the target branch */
  branch?: string;
  /** The k8s name for this repository */
  name: string;
  /** When syncing, where values are saved
    
    Possible enum values:
     - `"folder"` Resources will be saved into a folder managed by this repository It will contain a copy of everything from the remote The folder k8s name will be the same as the repository k8s name
     - `"instance"` Resources are saved in the global context Only one repository may specify the `instance` target When this exists, the UI will promote writing to the instance repo rather than the grafana database (where possible) */
  target: 'folder' | 'instance';
  /** Repository display */
  title: string;
  /** The repository type
    
    Possible enum values:
     - `"bitbucket"`
     - `"git"`
     - `"github"`
     - `"gitlab"`
     - `"local"` */
  type: 'bitbucket' | 'git' | 'github' | 'gitlab' | 'local';
  /** The supported workflows */
  workflows: ('branch' | 'write')[];
};
export type RepositoryViewList = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  /** AvailableRepositoryTypes is the list of repository types supported in this instance (e.g. git, bitbucket, github, etc) */
  availableRepositoryTypes?: ('bitbucket' | 'git' | 'github' | 'gitlab' | 'local')[];
  items: RepositoryView[];
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  /** The backend is using legacy storage FIXME: Not sure where this should be exposed... but we need it somewhere The UI should force the onboarding workflow when this is true */
  legacyStorage?: boolean;
};
export type ResourceCount = {
  count: number;
  group: string;
  resource: string;
};
export type ManagerStats = {
  /** Manager identity */
  id?: string;
  /** Manager kind */
  kind?: string;
  /** stats */
  stats: ResourceCount[];
};
export type ResourceStats = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  /** Stats across all unified storage When legacy storage is still used, this will offer a shim */
  instance?: ResourceCount[];
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  /** Stats for each manager */
  managed?: ManagerStats[];
  metadata?: any;
};
export const {
  useListJobQuery,
  useGetJobQuery,
  useListRepositoryQuery,
  useCreateRepositoryMutation,
  useDeletecollectionRepositoryMutation,
  useGetRepositoryQuery,
  useReplaceRepositoryMutation,
  useDeleteRepositoryMutation,
  useGetRepositoryFilesQuery,
  useGetRepositoryFilesWithPathQuery,
  useReplaceRepositoryFilesWithPathMutation,
  useCreateRepositoryFilesWithPathMutation,
  useDeleteRepositoryFilesWithPathMutation,
  useGetRepositoryHistoryQuery,
  useGetRepositoryHistoryWithPathQuery,
  useGetRepositoryJobsQuery,
  useCreateRepositoryJobsMutation,
  useGetRepositoryJobsWithPathQuery,
  useGetRepositoryRefsQuery,
  useGetRepositoryRenderWithPathQuery,
  useGetRepositoryResourcesQuery,
  useGetRepositoryStatusQuery,
  useReplaceRepositoryStatusMutation,
  useCreateRepositoryTestMutation,
  useGetRepositoryWebhookQuery,
  useCreateRepositoryWebhookMutation,
  useGetFrontendSettingsQuery,
  useGetResourceStatsQuery,
} = injectedRtkApi;
