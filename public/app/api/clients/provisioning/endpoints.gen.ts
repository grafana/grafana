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
  items?: any[];
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
export type Time = string;
export type FieldsV1 = object;
export type ManagedFieldsEntry = {
  /** APIVersion defines the version of this resource that this field set applies to. The format is "group/version" just like the top-level APIVersion field. It is necessary to track the version of a field set because it cannot be automatically converted. */
  apiVersion?: string;
  /** FieldsType is the discriminator for the different fields format and version. There is currently only one possible value: "FieldsV1" */
  fieldsType?: string;
  /** FieldsV1 holds the first JSON version format as described in the "FieldsV1" type. */
  fieldsV1?: FieldsV1;
  /** Manager is an identifier of the workflow managing these fields. */
  manager?: string;
  /** Operation is the type of operation which lead to this ManagedFieldsEntry being created. The only valid values for this field are 'Apply' and 'Update'. */
  operation?: string;
  /** Subresource is the name of the subresource used to update that object, or empty string if the object was updated through the main resource. The value of this field is used to distinguish between managers, even if they share the same name. For example, a status update will be distinct from a regular update using the same manager name. Note that the APIVersion field is not related to the Subresource field and it always corresponds to the version of the main resource. */
  subresource?: string;
  /** Time is the timestamp of when the ManagedFields entry was added. The timestamp will also be updated if a field is added, the manager changes any of the owned fields value or removes a field. The timestamp does not update when a field is removed from the entry because another manager took it over. */
  time?: Time;
};
export type OwnerReference = {
  /** API version of the referent. */
  apiVersion: string;
  /** If true, AND if the owner has the "foregroundDeletion" finalizer, then the owner cannot be deleted from the key-value store until this reference is removed. See https://kubernetes.io/docs/concepts/architecture/garbage-collection/#foreground-deletion for how the garbage collector interacts with this field and enforces the foreground deletion. Defaults to false. To set this field, a user needs "delete" permission of the owner, otherwise 422 (Unprocessable Entity) will be returned. */
  blockOwnerDeletion?: boolean;
  /** If true, this reference points to the managing controller. */
  controller?: boolean;
  /** Kind of the referent. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind: string;
  /** Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names */
  name: string;
  /** UID of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#uids */
  uid: string;
};
export type ObjectMeta = {
  /** Annotations is an unstructured key value map stored with a resource that may be set by external tools to store and retrieve arbitrary metadata. They are not queryable and should be preserved when modifying objects. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations */
  annotations?: {
    [key: string]: string;
  };
  /** CreationTimestamp is a timestamp representing the server time when this object was created. It is not guaranteed to be set in happens-before order across separate operations. Clients may not set this value. It is represented in RFC3339 form and is in UTC.
    
    Populated by the system. Read-only. Null for lists. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata */
  creationTimestamp?: Time;
  /** Number of seconds allowed for this object to gracefully terminate before it will be removed from the system. Only set when deletionTimestamp is also set. May only be shortened. Read-only. */
  deletionGracePeriodSeconds?: number;
  /** DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This field is set by the server when a graceful deletion is requested by the user, and is not directly settable by a client. The resource is expected to be deleted (no longer visible from resource lists, and not reachable by name) after the time in this field, once the finalizers list is empty. As long as the finalizers list contains items, deletion is blocked. Once the deletionTimestamp is set, this value may not be unset or be set further into the future, although it may be shortened or the resource may be deleted prior to this time. For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react by sending a graceful termination signal to the containers in the pod. After that 30 seconds, the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup, remove the pod from the API. In the presence of network partitions, this object may still exist after this timestamp, until an administrator or automated process can determine the resource is fully terminated. If not set, graceful deletion of the object has not been requested.
    
    Populated by the system when a graceful deletion is requested. Read-only. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata */
  deletionTimestamp?: Time;
  /** Must be empty before the object is deleted from the registry. Each entry is an identifier for the responsible component that will remove the entry from the list. If the deletionTimestamp of the object is non-nil, entries in this list can only be removed. Finalizers may be processed and removed in any order.  Order is NOT enforced because it introduces significant risk of stuck finalizers. finalizers is a shared field, any actor with permission can reorder it. If the finalizer list is processed in order, then this can lead to a situation in which the component responsible for the first finalizer in the list is waiting for a signal (field value, external system, or other) produced by a component responsible for a finalizer later in the list, resulting in a deadlock. Without enforced ordering finalizers are free to order amongst themselves and are not vulnerable to ordering changes in the list. */
  finalizers?: string[];
  /** GenerateName is an optional prefix, used by the server, to generate a unique name ONLY IF the Name field has not been provided. If this field is used, the name returned to the client will be different than the name passed. This value will also be combined with a unique suffix. The provided value has the same validation rules as the Name field, and may be truncated by the length of the suffix required to make the value unique on the server.
    
    If this field is specified and the generated name exists, the server will return a 409.
    
    Applied only if Name is not specified. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#idempotency */
  generateName?: string;
  /** A sequence number representing a specific generation of the desired state. Populated by the system. Read-only. */
  generation?: number;
  /** Map of string keys and values that can be used to organize and categorize (scope and select) objects. May match selectors of replication controllers and services. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels */
  labels?: {
    [key: string]: string;
  };
  /** ManagedFields maps workflow-id and version to the set of fields that are managed by that workflow. This is mostly for internal housekeeping, and users typically shouldn't need to set or understand this field. A workflow can be the user's name, a controller's name, or the name of a specific apply path like "ci-cd". The set of fields is always in the version that the workflow used when modifying the object. */
  managedFields?: ManagedFieldsEntry[];
  /** Name must be unique within a namespace. Is required when creating resources, although some resources may allow a client to request the generation of an appropriate name automatically. Name is primarily intended for creation idempotence and configuration definition. Cannot be updated. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names */
  name?: string;
  /** Namespace defines the space within which each name must be unique. An empty namespace is equivalent to the "default" namespace, but "default" is the canonical representation. Not all objects are required to be scoped to a namespace - the value of this field for those objects will be empty.
    
    Must be a DNS_LABEL. Cannot be updated. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces */
  namespace?: string;
  /** List of objects depended by this object. If ALL objects in the list have been deleted, this object will be garbage collected. If this object is managed by a controller, then an entry in this list will point to this controller, with the controller field set to true. There cannot be more than one managing controller. */
  ownerReferences?: OwnerReference[];
  /** An opaque value that represents the internal version of this object that can be used by clients to determine when objects have changed. May be used for optimistic concurrency, change detection, and the watch operation on a resource or set of resources. Clients must treat these values as opaque and passed unmodified back to the server. They may only be valid for a particular resource or set of resources.
    
    Populated by the system. Read-only. Value must be treated as opaque by clients and . More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency */
  resourceVersion?: string;
  /** Deprecated: selfLink is a legacy read-only field that is no longer populated by the system. */
  selfLink?: string;
  /** UID is the unique in time and space value for this object. It is typically generated by the server on successful creation of a resource and is not allowed to change on PUT operations.
    
    Populated by the system. Read-only. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#uids */
  uid?: string;
};
export type MigrateJobOptions = {
  /** Preserve history (if possible) */
  history?: boolean;
};
export type PullRequestJobOptions = {
  /** The specific commit hash that triggered this notice */
  hash?: string;
  /** Pull request number (when appropriate) */
  pr?: number;
  /** The branch of commit hash */
  ref?: string;
  /** URL to the originator (eg, PR URL) */
  url?: string;
};
export type SyncJobOptions = {
  /** Incremental synchronization for versioned repositories */
  incremental: boolean;
};
export type ExportJobOptions = {
  /** Target branch for export (only git) */
  branch?: string;
  /** The source folder (or empty) to export */
  folder?: string;
  /** Prefix in target file system */
  path?: string;
};
export type JobSpec = {
  /** Possible enum values:
     - `"migrate"` acts like JobActionExport, then JobActionPull. It also tries to preserve the history.
     - `"pr"` adds additional useful information to a PR, such as comments with preview links and rendered images.
     - `"pull"` replicates the remote branch in the local copy of the repository.
     - `"push"` replicates the local copy of the repository in the remote branch. */
  action?: 'migrate' | 'pr' | 'pull' | 'push';
  /** Required when the action is `migrate` */
  migrate?: MigrateJobOptions;
  /** Pull request options */
  pr?: PullRequestJobOptions;
  /** Required when the action is `pull` */
  pull?: SyncJobOptions;
  /** Required when the action is `push` */
  push?: ExportJobOptions;
  /** The the repository reference (for now also in labels) This value is required, but will be popuplated from the job making the request */
  repository?: string;
};
export type JobResourceSummary = {
  create?: number;
  delete?: number;
  /** Create or update (export) */
  error?: number;
  /** Report errors for this resource type This may not be an exhaustive list and recommend looking at the logs for more info */
  errors?: string[];
  group?: string;
  /** No action required (useful for sync) */
  noop?: number;
  resource?: string;
  total?: number;
  update?: number;
  write?: number;
};
export type JobStatus = {
  errors?: string[];
  finished?: number;
  message?: string;
  /** Optional value 0-100 that can be set while running */
  progress?: number;
  started?: number;
  /** Possible enum values:
     - `"error"` Finished with errors
     - `"pending"` Job has been submitted, but not processed yet
     - `"success"` Finished with success
     - `"working"` The job is running */
  state?: 'error' | 'pending' | 'success' | 'working';
  /** Summary of processed actions */
  summary?: JobResourceSummary[];
};
export type Job = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  metadata?: ObjectMeta;
  spec?: JobSpec;
  status?: JobStatus;
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
export type JobList = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  items?: Job[];
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  metadata?: ListMeta;
};
export type GitHubRepositoryConfig = {
  /** The branch to use in the repository. */
  branch: string;
  /** Token for accessing the repository, but encrypted. This is not possible to read back to a user decrypted. */
  encryptedToken?: string;
  /** Whether we should show dashboard previews for pull requests. By default, this is false (i.e. we will not create previews). */
  generateDashboardPreviews?: boolean;
  /** Path is the subdirectory for the Grafana data. If specified, Grafana will ignore anything that is outside this directory in the repository. This is usually something like `grafana/`. Trailing and leading slash are not required. They are always added when needed. The path is relative to the root of the repository, regardless of the leading slash.
    
    When specifying something like `grafana-`, we will not look for `grafana-*`; we will only look for files under the directory `/grafana-/`. That means `/grafana-example.json` would not be found. */
  path?: string;
  /** Token for accessing the repository. If set, it will be encrypted into encryptedToken, then set to an empty string again. */
  token?: string;
  /** The repository URL (e.g. `https://github.com/example/test`). */
  url?: string;
};
export type LocalRepositoryConfig = {
  path?: string;
};
export type SyncOptions = {
  /** Enabled must be saved as true before any sync job will run */
  enabled: boolean;
  /** When non-zero, the sync will run periodically */
  intervalSeconds?: number;
  /** Where values should be saved
    
    Possible enum values:
     - `"folder"` Resources will be saved into a folder managed by this repository It will contain a copy of everything from the remote The folder k8s name will be the same as the repository k8s name
     - `"instance"` Resources are saved in the global context Only one repository may specify the `instance` target When this exists, the UI will promote writing to the instance repo rather than the grafana database (where possible) */
  target: 'folder' | 'instance';
};
export type RepositorySpec = {
  /** Repository description */
  description?: string;
  /** The repository on GitHub. Mutually exclusive with local | github. */
  github?: GitHubRepositoryConfig;
  /** The repository on the local file system. Mutually exclusive with local | github. */
  local?: LocalRepositoryConfig;
  /** Sync settings -- how values are pulled from the repository into grafana */
  sync: SyncOptions;
  /** The repository display name (shown in the UI) */
  title: string;
  /** The repository type.  When selected oneOf the values below should be non-nil
    
    Possible enum values:
     - `"github"`
     - `"local"` */
  type: 'github' | 'local';
  /** UI driven Workflow that allow changes to the contends of the repository. The order is relevant for defining the precedence of the workflows. When empty, the repository does not support any edits (eg, readonly) */
  workflows: ('branch' | 'write')[];
};
export type HealthStatus = {
  /** When the health was checked last time */
  checked?: number;
  /** When not healthy, requests will not be executed */
  healthy: boolean;
  /** Summary messages (can be shown to users) Will only be populated when not healthy */
  message?: string[];
};
export type ResourceCount = {
  count: number;
  group: string;
  resource: string;
};
export type SyncStatus = {
  /** When the sync job finished */
  finished?: number;
  /** Incremental synchronization for versioned repositories */
  incremental?: boolean;
  /** The ID for the job that ran this sync */
  job?: string;
  /** The repository ref when the last successful sync ran */
  lastRef?: string;
  /** Summary messages (will be shown to users) */
  message: string[];
  /** When the next sync check is scheduled */
  scheduled?: number;
  /** When the sync job started */
  started?: number;
  /** pending, running, success, error
    
    Possible enum values:
     - `"error"` Finished with errors
     - `"pending"` Job has been submitted, but not processed yet
     - `"success"` Finished with success
     - `"working"` The job is running */
  state: 'error' | 'pending' | 'success' | 'working';
};
export type WebhookStatus = {
  encryptedSecret?: string;
  id?: number;
  lastEvent?: number;
  secret?: string;
  subscribedEvents?: string[];
  url?: string;
};
export type RepositoryStatus = {
  /** This will get updated with the current health status (and updated periodically) */
  health: HealthStatus;
  /** The generation of the spec last time reconciliation ran */
  observedGeneration: number;
  /** The object count when sync last ran */
  stats?: ResourceCount[];
  /** Sync information with the last sync information */
  sync: SyncStatus;
  /** Webhook Information (if applicable) */
  webhook: WebhookStatus;
};
export type Repository = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  metadata?: ObjectMeta;
  spec?: RepositorySpec;
  status?: RepositoryStatus;
};
export type RepositoryList = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  items?: Repository[];
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  metadata?: ListMeta;
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
export type ResourceRepositoryInfo = {
  /** The name (identifier) */
  name: string;
  /** The namespace this belongs to */
  namespace: string;
  /** The display name for this repository */
  title: string;
  /** The repository type
    
    Possible enum values:
     - `"github"`
     - `"local"` */
  type: 'github' | 'local';
};
export type Unstructured = {
  [key: string]: any;
};
export type ResourceType = {
  /** For non-k8s native formats, what did this start as
    
    Possible enum values:
     - `"access-control"` Access control https://github.com/grafana/grafana/blob/v11.3.1/conf/provisioning/access-control/sample.yaml
     - `"alerting"` Alert configuration https://github.com/grafana/grafana/blob/v11.3.1/conf/provisioning/alerting/sample.yaml
     - `"dashboard"` Dashboard JSON
     - `"datasources"` Datasource definitions eg: https://github.com/grafana/grafana/blob/v11.3.1/conf/provisioning/datasources/sample.yaml */
  classic?: 'access-control' | 'alerting' | 'dashboard' | 'datasources';
  group?: string;
  kind?: string;
  resource?: string;
  version?: string;
};
export type ResourceObjects = {
  /** The action required/used for dryRun
    
    Possible enum values:
     - `"create"`
     - `"delete"`
     - `"update"` */
  action?: 'create' | 'delete' | 'update';
  /** The value returned from a dryRun request */
  dryRun?: Unstructured;
  /** The same value, currently saved in the grafana database */
  existing?: Unstructured;
  /** The resource from the repository with all modifications applied eg, the name, folder etc will all be applied to this object */
  file?: Unstructured;
  /** The identified type for this object */
  type: ResourceType;
  /** For write events, this will return the value that was added or updated */
  upsert?: Unstructured;
};
export type ResourceUrLs = {
  /** Compare this version to the target branch */
  compareURL?: string;
  /** A URL that will create a new pull requeset for this branch */
  newPullRequestURL?: string;
  /** A URL pointing to the repository this lives in */
  repositoryURL?: string;
  /** A URL pointing to the this file in the repository */
  sourceURL?: string;
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
  repository: ResourceRepositoryInfo;
  /** Different flavors of the same object */
  resource: ResourceObjects;
  /** The modified time in the remote file system */
  timestamp?: Time;
  /** Typed links for this file (only supported by external systems, github etc) */
  urls?: ResourceUrLs;
};
export type ResourceListItem = {
  folder?: string;
  group: string;
  /** the k8s identifier */
  hash: string;
  name: string;
  path: string;
  resource: string;
  time?: number;
  title?: string;
};
export type ResourceList = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  items?: ResourceListItem[];
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  metadata?: ListMeta;
};
export type ErrorDetails = {
  detail?: string;
  field?: string;
  type: string;
};
export type TestResults = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  /** HTTP status code */
  code: number;
  /** Field related errors */
  errors?: ErrorDetails[];
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
  job?: JobSpec;
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
     - `"github"`
     - `"local"` */
  type: 'github' | 'local';
  /** The supported workflows */
  workflows: ('branch' | 'write')[];
};
export type RepositoryViewList = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  items: RepositoryView[];
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  /** The backend is using legacy storage FIXME: Not sure where this should be exposed... but we need it somewhere The UI should force the onboarding workflow when this is true */
  legacyStorage?: boolean;
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
