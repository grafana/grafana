import { baseAPI as api } from './baseAPI';
const injectedRtkApi = api.injectEndpoints({
  endpoints: (build) => ({
    listNamespacedJob: build.query<ListNamespacedJobResponse, ListNamespacedJobArg>({
      query: (queryArg) => ({
        url: `/apis/provisioning.grafana.app/v0alpha1/namespaces/${queryArg['namespace']}/jobs`,
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
    }),
    readNamespacedJob: build.query<ReadNamespacedJobResponse, ReadNamespacedJobArg>({
      query: (queryArg) => ({
        url: `/apis/provisioning.grafana.app/v0alpha1/namespaces/${queryArg['namespace']}/jobs/${queryArg.name}`,
        params: { pretty: queryArg.pretty },
      }),
    }),
    listNamespacedRepository: build.query<ListNamespacedRepositoryResponse, ListNamespacedRepositoryArg>({
      query: (queryArg) => ({
        url: `/apis/provisioning.grafana.app/v0alpha1/namespaces/${queryArg['namespace']}/repositories`,
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
    }),
    createNamespacedRepository: build.mutation<CreateNamespacedRepositoryResponse, CreateNamespacedRepositoryArg>({
      query: (queryArg) => ({
        url: `/apis/provisioning.grafana.app/v0alpha1/namespaces/${queryArg['namespace']}/repositories`,
        method: 'POST',
        body: queryArg.comGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1Repository,
        params: {
          pretty: queryArg.pretty,
          dryRun: queryArg.dryRun,
          fieldManager: queryArg.fieldManager,
          fieldValidation: queryArg.fieldValidation,
        },
      }),
    }),
    readNamespacedRepository: build.query<ReadNamespacedRepositoryResponse, ReadNamespacedRepositoryArg>({
      query: (queryArg) => ({
        url: `/apis/provisioning.grafana.app/v0alpha1/namespaces/${queryArg['namespace']}/repositories/${queryArg.name}`,
        params: { pretty: queryArg.pretty },
      }),
    }),
    replaceNamespacedRepository: build.mutation<ReplaceNamespacedRepositoryResponse, ReplaceNamespacedRepositoryArg>({
      query: (queryArg) => ({
        url: `/apis/provisioning.grafana.app/v0alpha1/namespaces/${queryArg['namespace']}/repositories/${queryArg.name}`,
        method: 'PUT',
        body: queryArg.comGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1Repository,
        params: {
          pretty: queryArg.pretty,
          dryRun: queryArg.dryRun,
          fieldManager: queryArg.fieldManager,
          fieldValidation: queryArg.fieldValidation,
        },
      }),
    }),
    deleteNamespacedRepository: build.mutation<DeleteNamespacedRepositoryResponse, DeleteNamespacedRepositoryArg>({
      query: (queryArg) => ({
        url: `/apis/provisioning.grafana.app/v0alpha1/namespaces/${queryArg['namespace']}/repositories/${queryArg.name}`,
        method: 'DELETE',
        body: queryArg.ioK8SApimachineryPkgApisMetaV1DeleteOptions,
        params: {
          pretty: queryArg.pretty,
          dryRun: queryArg.dryRun,
          gracePeriodSeconds: queryArg.gracePeriodSeconds,
          orphanDependents: queryArg.orphanDependents,
          propagationPolicy: queryArg.propagationPolicy,
        },
      }),
    }),
    patchNamespacedRepository: build.mutation<PatchNamespacedRepositoryResponse, PatchNamespacedRepositoryArg>({
      query: (queryArg) => ({
        url: `/apis/provisioning.grafana.app/v0alpha1/namespaces/${queryArg['namespace']}/repositories/${queryArg.name}`,
        method: 'PATCH',
        body: queryArg.ioK8SApimachineryPkgApisMetaV1Patch,
        params: {
          pretty: queryArg.pretty,
          dryRun: queryArg.dryRun,
          fieldManager: queryArg.fieldManager,
          fieldValidation: queryArg.fieldValidation,
          force: queryArg.force,
        },
      }),
    }),
    connectPostNamespacedRepositoryExport: build.mutation<
      ConnectPostNamespacedRepositoryExportResponse,
      ConnectPostNamespacedRepositoryExportArg
    >({
      query: (queryArg) => ({
        url: `/apis/provisioning.grafana.app/v0alpha1/namespaces/${queryArg['namespace']}/repositories/${queryArg.name}/export`,
        method: 'POST',
      }),
    }),
    connectGetNamespacedRepositoryFiles: build.query<
      ConnectGetNamespacedRepositoryFilesResponse,
      ConnectGetNamespacedRepositoryFilesArg
    >({
      query: (queryArg) => ({
        url: `/apis/provisioning.grafana.app/v0alpha1/namespaces/${queryArg['namespace']}/repositories/${queryArg.name}/files/`,
        params: { ref: queryArg.ref },
      }),
    }),
    connectGetNamespacedRepositoryFilesWithPath: build.query<
      ConnectGetNamespacedRepositoryFilesWithPathResponse,
      ConnectGetNamespacedRepositoryFilesWithPathArg
    >({
      query: (queryArg) => ({
        url: `/apis/provisioning.grafana.app/v0alpha1/namespaces/${queryArg['namespace']}/repositories/${queryArg.name}/files/${queryArg.path}`,
        params: { ref: queryArg.ref },
      }),
    }),
    connectPutNamespacedRepositoryFilesWithPath: build.mutation<
      ConnectPutNamespacedRepositoryFilesWithPathResponse,
      ConnectPutNamespacedRepositoryFilesWithPathArg
    >({
      query: (queryArg) => ({
        url: `/apis/provisioning.grafana.app/v0alpha1/namespaces/${queryArg['namespace']}/repositories/${queryArg.name}/files/${queryArg.path}`,
        method: 'PUT',
        body: queryArg.body,
        params: { ref: queryArg.ref, message: queryArg.message },
      }),
    }),
    connectPostNamespacedRepositoryFilesWithPath: build.mutation<
      ConnectPostNamespacedRepositoryFilesWithPathResponse,
      ConnectPostNamespacedRepositoryFilesWithPathArg
    >({
      query: (queryArg) => ({
        url: `/apis/provisioning.grafana.app/v0alpha1/namespaces/${queryArg['namespace']}/repositories/${queryArg.name}/files/${queryArg.path}`,
        method: 'POST',
        body: queryArg.body,
        params: { ref: queryArg.ref, message: queryArg.message },
      }),
    }),
    connectDeleteNamespacedRepositoryFilesWithPath: build.mutation<
      ConnectDeleteNamespacedRepositoryFilesWithPathResponse,
      ConnectDeleteNamespacedRepositoryFilesWithPathArg
    >({
      query: (queryArg) => ({
        url: `/apis/provisioning.grafana.app/v0alpha1/namespaces/${queryArg['namespace']}/repositories/${queryArg.name}/files/${queryArg.path}`,
        method: 'DELETE',
        params: { ref: queryArg.ref, message: queryArg.message },
      }),
    }),
    connectGetNamespacedRepositoryHistory: build.query<
      ConnectGetNamespacedRepositoryHistoryResponse,
      ConnectGetNamespacedRepositoryHistoryArg
    >({
      query: (queryArg) => ({
        url: `/apis/provisioning.grafana.app/v0alpha1/namespaces/${queryArg['namespace']}/repositories/${queryArg.name}/history`,
        params: { ref: queryArg.ref },
      }),
    }),
    connectGetNamespacedRepositoryHistoryWithPath: build.query<
      ConnectGetNamespacedRepositoryHistoryWithPathResponse,
      ConnectGetNamespacedRepositoryHistoryWithPathArg
    >({
      query: (queryArg) => ({
        url: `/apis/provisioning.grafana.app/v0alpha1/namespaces/${queryArg['namespace']}/repositories/${queryArg.name}/history/${queryArg.path}`,
        params: { ref: queryArg.ref },
      }),
    }),
    readNamespacedRepositoryStatus: build.query<
      ReadNamespacedRepositoryStatusResponse,
      ReadNamespacedRepositoryStatusArg
    >({
      query: (queryArg) => ({
        url: `/apis/provisioning.grafana.app/v0alpha1/namespaces/${queryArg['namespace']}/repositories/${queryArg.name}/status`,
        params: { pretty: queryArg.pretty },
      }),
    }),
    replaceNamespacedRepositoryStatus: build.mutation<
      ReplaceNamespacedRepositoryStatusResponse,
      ReplaceNamespacedRepositoryStatusArg
    >({
      query: (queryArg) => ({
        url: `/apis/provisioning.grafana.app/v0alpha1/namespaces/${queryArg['namespace']}/repositories/${queryArg.name}/status`,
        method: 'PUT',
        body: queryArg.comGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1Repository,
        params: {
          pretty: queryArg.pretty,
          dryRun: queryArg.dryRun,
          fieldManager: queryArg.fieldManager,
          fieldValidation: queryArg.fieldValidation,
        },
      }),
    }),
    patchNamespacedRepositoryStatus: build.mutation<
      PatchNamespacedRepositoryStatusResponse,
      PatchNamespacedRepositoryStatusArg
    >({
      query: (queryArg) => ({
        url: `/apis/provisioning.grafana.app/v0alpha1/namespaces/${queryArg['namespace']}/repositories/${queryArg.name}/status`,
        method: 'PATCH',
        body: queryArg.ioK8SApimachineryPkgApisMetaV1Patch,
        params: {
          pretty: queryArg.pretty,
          dryRun: queryArg.dryRun,
          fieldManager: queryArg.fieldManager,
          fieldValidation: queryArg.fieldValidation,
          force: queryArg.force,
        },
      }),
    }),
    connectPostNamespacedRepositorySync: build.mutation<
      ConnectPostNamespacedRepositorySyncResponse,
      ConnectPostNamespacedRepositorySyncArg
    >({
      query: (queryArg) => ({
        url: `/apis/provisioning.grafana.app/v0alpha1/namespaces/${queryArg['namespace']}/repositories/${queryArg.name}/sync`,
        method: 'POST',
      }),
    }),
    connectPostNamespacedRepositoryTest: build.mutation<
      ConnectPostNamespacedRepositoryTestResponse,
      ConnectPostNamespacedRepositoryTestArg
    >({
      query: (queryArg) => ({
        url: `/apis/provisioning.grafana.app/v0alpha1/namespaces/${queryArg['namespace']}/repositories/${queryArg.name}/test`,
        method: 'POST',
        body: queryArg.body,
      }),
    }),
    connectGetNamespacedRepositoryWebhook: build.query<
      ConnectGetNamespacedRepositoryWebhookResponse,
      ConnectGetNamespacedRepositoryWebhookArg
    >({
      query: (queryArg) => ({
        url: `/apis/provisioning.grafana.app/v0alpha1/namespaces/${queryArg['namespace']}/repositories/${queryArg.name}/webhook`,
      }),
    }),
    connectPostNamespacedRepositoryWebhook: build.mutation<
      ConnectPostNamespacedRepositoryWebhookResponse,
      ConnectPostNamespacedRepositoryWebhookArg
    >({
      query: (queryArg) => ({
        url: `/apis/provisioning.grafana.app/v0alpha1/namespaces/${queryArg['namespace']}/repositories/${queryArg.name}/webhook`,
        method: 'POST',
      }),
    }),
  }),
  overrideExisting: false,
});
export { injectedRtkApi as generatedAPI };
export type ListNamespacedJobResponse = /** status 200 OK */ ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1JobList;
export type ListNamespacedJobArg = {
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
  /** object name and auth scope, such as for teams and projects */
  namespace: string;
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
export type ReadNamespacedJobResponse = /** status 200 OK */ ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1Job;
export type ReadNamespacedJobArg = {
  /** name of the Job */
  name: string;
  /** object name and auth scope, such as for teams and projects */
  namespace: string;
  /** If 'true', then the output is pretty printed. Defaults to 'false' unless the user-agent indicates a browser or command-line HTTP tool (curl and wget). */
  pretty?: string;
};
export type ListNamespacedRepositoryResponse =
  /** status 200 OK */ ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1RepositoryList;
export type ListNamespacedRepositoryArg = {
  /** object name and auth scope, such as for teams and projects */
  namespace: string;
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
export type CreateNamespacedRepositoryResponse = /** status 200 OK */
  | ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1Repository
  | /** status 201 Created */ ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1Repository
  | /** status 202 Accepted */ ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1Repository;
export type CreateNamespacedRepositoryArg = {
  /** object name and auth scope, such as for teams and projects */
  namespace: string;
  /** If 'true', then the output is pretty printed. Defaults to 'false' unless the user-agent indicates a browser or command-line HTTP tool (curl and wget). */
  pretty?: string;
  /** When present, indicates that modifications should not be persisted. An invalid or unrecognized dryRun directive will result in an error response and no further processing of the request. Valid values are: - All: all dry run stages will be processed */
  dryRun?: string;
  /** fieldManager is a name associated with the actor or entity that is making these changes. The value must be less than or 128 characters long, and only contain printable characters, as defined by https://golang.org/pkg/unicode/#IsPrint. */
  fieldManager?: string;
  /** fieldValidation instructs the server on how to handle objects in the request (POST/PUT/PATCH) containing unknown or duplicate fields. Valid values are: - Ignore: This will ignore any unknown fields that are silently dropped from the object, and will ignore all but the last duplicate field that the decoder encounters. This is the default behavior prior to v1.23. - Warn: This will send a warning via the standard warning response header for each unknown field that is dropped from the object, and for each duplicate field that is encountered. The request will still succeed if there are no other errors, and will only persist the last of any duplicate fields. This is the default in v1.23+ - Strict: This will fail the request with a BadRequest error if any unknown fields would be dropped from the object, or if any duplicate fields are present. The error returned from the server will contain all unknown and duplicate fields encountered. */
  fieldValidation?: string;
  comGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1Repository: ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1Repository;
};
export type ReadNamespacedRepositoryResponse =
  /** status 200 OK */ ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1Repository;
export type ReadNamespacedRepositoryArg = {
  /** name of the Repository */
  name: string;
  /** object name and auth scope, such as for teams and projects */
  namespace: string;
  /** If 'true', then the output is pretty printed. Defaults to 'false' unless the user-agent indicates a browser or command-line HTTP tool (curl and wget). */
  pretty?: string;
};
export type ReplaceNamespacedRepositoryResponse = /** status 200 OK */
  | ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1Repository
  | /** status 201 Created */ ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1Repository;
export type ReplaceNamespacedRepositoryArg = {
  /** name of the Repository */
  name: string;
  /** object name and auth scope, such as for teams and projects */
  namespace: string;
  /** If 'true', then the output is pretty printed. Defaults to 'false' unless the user-agent indicates a browser or command-line HTTP tool (curl and wget). */
  pretty?: string;
  /** When present, indicates that modifications should not be persisted. An invalid or unrecognized dryRun directive will result in an error response and no further processing of the request. Valid values are: - All: all dry run stages will be processed */
  dryRun?: string;
  /** fieldManager is a name associated with the actor or entity that is making these changes. The value must be less than or 128 characters long, and only contain printable characters, as defined by https://golang.org/pkg/unicode/#IsPrint. */
  fieldManager?: string;
  /** fieldValidation instructs the server on how to handle objects in the request (POST/PUT/PATCH) containing unknown or duplicate fields. Valid values are: - Ignore: This will ignore any unknown fields that are silently dropped from the object, and will ignore all but the last duplicate field that the decoder encounters. This is the default behavior prior to v1.23. - Warn: This will send a warning via the standard warning response header for each unknown field that is dropped from the object, and for each duplicate field that is encountered. The request will still succeed if there are no other errors, and will only persist the last of any duplicate fields. This is the default in v1.23+ - Strict: This will fail the request with a BadRequest error if any unknown fields would be dropped from the object, or if any duplicate fields are present. The error returned from the server will contain all unknown and duplicate fields encountered. */
  fieldValidation?: string;
  comGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1Repository: ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1Repository;
};
export type DeleteNamespacedRepositoryResponse = /** status 200 OK */
  | IoK8SApimachineryPkgApisMetaV1Status
  | /** status 202 Accepted */ IoK8SApimachineryPkgApisMetaV1Status;
export type DeleteNamespacedRepositoryArg = {
  /** name of the Repository */
  name: string;
  /** object name and auth scope, such as for teams and projects */
  namespace: string;
  /** If 'true', then the output is pretty printed. Defaults to 'false' unless the user-agent indicates a browser or command-line HTTP tool (curl and wget). */
  pretty?: string;
  /** When present, indicates that modifications should not be persisted. An invalid or unrecognized dryRun directive will result in an error response and no further processing of the request. Valid values are: - All: all dry run stages will be processed */
  dryRun?: string;
  /** The duration in seconds before the object should be deleted. Value must be non-negative integer. The value zero indicates delete immediately. If this value is nil, the default grace period for the specified type will be used. Defaults to a per object value if not specified. zero means delete immediately. */
  gracePeriodSeconds?: number;
  /** Deprecated: please use the PropagationPolicy, this field will be deprecated in 1.7. Should the dependent objects be orphaned. If true/false, the "orphan" finalizer will be added to/removed from the object's finalizers list. Either this field or PropagationPolicy may be set, but not both. */
  orphanDependents?: boolean;
  /** Whether and how garbage collection will be performed. Either this field or OrphanDependents may be set, but not both. The default policy is decided by the existing finalizer set in the metadata.finalizers and the resource-specific default policy. Acceptable values are: 'Orphan' - orphan the dependents; 'Background' - allow the garbage collector to delete the dependents in the background; 'Foreground' - a cascading policy that deletes all dependents in the foreground. */
  propagationPolicy?: string;
  ioK8SApimachineryPkgApisMetaV1DeleteOptions: IoK8SApimachineryPkgApisMetaV1DeleteOptions;
};
export type PatchNamespacedRepositoryResponse = /** status 200 OK */
  | ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1Repository
  | /** status 201 Created */ ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1Repository;
export type PatchNamespacedRepositoryArg = {
  /** name of the Repository */
  name: string;
  /** object name and auth scope, such as for teams and projects */
  namespace: string;
  /** If 'true', then the output is pretty printed. Defaults to 'false' unless the user-agent indicates a browser or command-line HTTP tool (curl and wget). */
  pretty?: string;
  /** When present, indicates that modifications should not be persisted. An invalid or unrecognized dryRun directive will result in an error response and no further processing of the request. Valid values are: - All: all dry run stages will be processed */
  dryRun?: string;
  /** fieldManager is a name associated with the actor or entity that is making these changes. The value must be less than or 128 characters long, and only contain printable characters, as defined by https://golang.org/pkg/unicode/#IsPrint. This field is required for apply requests (application/apply-patch) but optional for non-apply patch types (JsonPatch, MergePatch, StrategicMergePatch). */
  fieldManager?: string;
  /** fieldValidation instructs the server on how to handle objects in the request (POST/PUT/PATCH) containing unknown or duplicate fields. Valid values are: - Ignore: This will ignore any unknown fields that are silently dropped from the object, and will ignore all but the last duplicate field that the decoder encounters. This is the default behavior prior to v1.23. - Warn: This will send a warning via the standard warning response header for each unknown field that is dropped from the object, and for each duplicate field that is encountered. The request will still succeed if there are no other errors, and will only persist the last of any duplicate fields. This is the default in v1.23+ - Strict: This will fail the request with a BadRequest error if any unknown fields would be dropped from the object, or if any duplicate fields are present. The error returned from the server will contain all unknown and duplicate fields encountered. */
  fieldValidation?: string;
  /** Force is going to "force" Apply requests. It means user will re-acquire conflicting fields owned by other people. Force flag must be unset for non-apply patch requests. */
  force?: boolean;
  ioK8SApimachineryPkgApisMetaV1Patch: IoK8SApimachineryPkgApisMetaV1Patch;
};
export type ConnectPostNamespacedRepositoryExportResponse =
  /** status 200 OK */ ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1Job;
export type ConnectPostNamespacedRepositoryExportArg = {
  /** name of the Job */
  name: string;
  /** object name and auth scope, such as for teams and projects */
  namespace: string;
};
export type ConnectGetNamespacedRepositoryFilesResponse = /** status 200 OK */ {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  /** should be named "items", but avoid subresource error for now: kubernetes/kubernetes#126809 */
  files?: any[];
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  metadata?: any;
};
export type ConnectGetNamespacedRepositoryFilesArg = {
  /** name of the ResourceWrapper */
  name: string;
  /** object name and auth scope, such as for teams and projects */
  namespace: string;
  /** branch or commit hash */
  ref?: string;
};
export type ConnectGetNamespacedRepositoryFilesWithPathResponse =
  /** status 200 OK */ ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1ResourceWrapper;
export type ConnectGetNamespacedRepositoryFilesWithPathArg = {
  /** name of the ResourceWrapper */
  name: string;
  /** object name and auth scope, such as for teams and projects */
  namespace: string;
  /** path to the resource */
  path: string;
  /** branch or commit hash */
  ref?: string;
};
export type ConnectPutNamespacedRepositoryFilesWithPathResponse =
  /** status 200 OK */ ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1ResourceWrapper;
export type ConnectPutNamespacedRepositoryFilesWithPathArg = {
  /** name of the ResourceWrapper */
  name: string;
  /** object name and auth scope, such as for teams and projects */
  namespace: string;
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
export type ConnectPostNamespacedRepositoryFilesWithPathResponse =
  /** status 200 OK */ ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1ResourceWrapper;
export type ConnectPostNamespacedRepositoryFilesWithPathArg = {
  /** name of the ResourceWrapper */
  name: string;
  /** object name and auth scope, such as for teams and projects */
  namespace: string;
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
export type ConnectDeleteNamespacedRepositoryFilesWithPathResponse =
  /** status 200 OK */ ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1ResourceWrapper;
export type ConnectDeleteNamespacedRepositoryFilesWithPathArg = {
  /** name of the ResourceWrapper */
  name: string;
  /** object name and auth scope, such as for teams and projects */
  namespace: string;
  /** path to the resource */
  path: string;
  /** branch or commit hash */
  ref?: string;
  /** optional message sent with any changes */
  message?: string;
};
export type ConnectGetNamespacedRepositoryHistoryResponse = /** status 200 OK */ string;
export type ConnectGetNamespacedRepositoryHistoryArg = {
  /** name of the HistoryList */
  name: string;
  /** object name and auth scope, such as for teams and projects */
  namespace: string;
  /** branch or commit hash */
  ref?: string;
};
export type ConnectGetNamespacedRepositoryHistoryWithPathResponse = /** status 200 OK */ string;
export type ConnectGetNamespacedRepositoryHistoryWithPathArg = {
  /** name of the HistoryList */
  name: string;
  /** object name and auth scope, such as for teams and projects */
  namespace: string;
  /** path to the resource */
  path: string;
  /** branch or commit hash */
  ref?: string;
};
export type ReadNamespacedRepositoryStatusResponse =
  /** status 200 OK */ ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1Repository;
export type ReadNamespacedRepositoryStatusArg = {
  /** name of the Repository */
  name: string;
  /** object name and auth scope, such as for teams and projects */
  namespace: string;
  /** If 'true', then the output is pretty printed. Defaults to 'false' unless the user-agent indicates a browser or command-line HTTP tool (curl and wget). */
  pretty?: string;
};
export type ReplaceNamespacedRepositoryStatusResponse = /** status 200 OK */
  | ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1Repository
  | /** status 201 Created */ ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1Repository;
export type ReplaceNamespacedRepositoryStatusArg = {
  /** name of the Repository */
  name: string;
  /** object name and auth scope, such as for teams and projects */
  namespace: string;
  /** If 'true', then the output is pretty printed. Defaults to 'false' unless the user-agent indicates a browser or command-line HTTP tool (curl and wget). */
  pretty?: string;
  /** When present, indicates that modifications should not be persisted. An invalid or unrecognized dryRun directive will result in an error response and no further processing of the request. Valid values are: - All: all dry run stages will be processed */
  dryRun?: string;
  /** fieldManager is a name associated with the actor or entity that is making these changes. The value must be less than or 128 characters long, and only contain printable characters, as defined by https://golang.org/pkg/unicode/#IsPrint. */
  fieldManager?: string;
  /** fieldValidation instructs the server on how to handle objects in the request (POST/PUT/PATCH) containing unknown or duplicate fields. Valid values are: - Ignore: This will ignore any unknown fields that are silently dropped from the object, and will ignore all but the last duplicate field that the decoder encounters. This is the default behavior prior to v1.23. - Warn: This will send a warning via the standard warning response header for each unknown field that is dropped from the object, and for each duplicate field that is encountered. The request will still succeed if there are no other errors, and will only persist the last of any duplicate fields. This is the default in v1.23+ - Strict: This will fail the request with a BadRequest error if any unknown fields would be dropped from the object, or if any duplicate fields are present. The error returned from the server will contain all unknown and duplicate fields encountered. */
  fieldValidation?: string;
  comGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1Repository: ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1Repository;
};
export type PatchNamespacedRepositoryStatusResponse = /** status 200 OK */
  | ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1Repository
  | /** status 201 Created */ ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1Repository;
export type PatchNamespacedRepositoryStatusArg = {
  /** name of the Repository */
  name: string;
  /** object name and auth scope, such as for teams and projects */
  namespace: string;
  /** If 'true', then the output is pretty printed. Defaults to 'false' unless the user-agent indicates a browser or command-line HTTP tool (curl and wget). */
  pretty?: string;
  /** When present, indicates that modifications should not be persisted. An invalid or unrecognized dryRun directive will result in an error response and no further processing of the request. Valid values are: - All: all dry run stages will be processed */
  dryRun?: string;
  /** fieldManager is a name associated with the actor or entity that is making these changes. The value must be less than or 128 characters long, and only contain printable characters, as defined by https://golang.org/pkg/unicode/#IsPrint. This field is required for apply requests (application/apply-patch) but optional for non-apply patch types (JsonPatch, MergePatch, StrategicMergePatch). */
  fieldManager?: string;
  /** fieldValidation instructs the server on how to handle objects in the request (POST/PUT/PATCH) containing unknown or duplicate fields. Valid values are: - Ignore: This will ignore any unknown fields that are silently dropped from the object, and will ignore all but the last duplicate field that the decoder encounters. This is the default behavior prior to v1.23. - Warn: This will send a warning via the standard warning response header for each unknown field that is dropped from the object, and for each duplicate field that is encountered. The request will still succeed if there are no other errors, and will only persist the last of any duplicate fields. This is the default in v1.23+ - Strict: This will fail the request with a BadRequest error if any unknown fields would be dropped from the object, or if any duplicate fields are present. The error returned from the server will contain all unknown and duplicate fields encountered. */
  fieldValidation?: string;
  /** Force is going to "force" Apply requests. It means user will re-acquire conflicting fields owned by other people. Force flag must be unset for non-apply patch requests. */
  force?: boolean;
  ioK8SApimachineryPkgApisMetaV1Patch: IoK8SApimachineryPkgApisMetaV1Patch;
};
export type ConnectPostNamespacedRepositorySyncResponse =
  /** status 200 OK */ ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1Job;
export type ConnectPostNamespacedRepositorySyncArg = {
  /** name of the Job */
  name: string;
  /** object name and auth scope, such as for teams and projects */
  namespace: string;
};
export type ConnectPostNamespacedRepositoryTestResponse =
  /** status 200 OK */ ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1TestResults;
export type ConnectPostNamespacedRepositoryTestArg = {
  /** name of the TestResults */
  name: string;
  /** object name and auth scope, such as for teams and projects */
  namespace: string;
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
export type ConnectGetNamespacedRepositoryWebhookResponse =
  /** status 200 OK */ ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1WebhookResponse;
export type ConnectGetNamespacedRepositoryWebhookArg = {
  /** name of the WebhookResponse */
  name: string;
  /** object name and auth scope, such as for teams and projects */
  namespace: string;
};
export type ConnectPostNamespacedRepositoryWebhookResponse =
  /** status 200 OK */ ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1WebhookResponse;
export type ConnectPostNamespacedRepositoryWebhookArg = {
  /** name of the WebhookResponse */
  name: string;
  /** object name and auth scope, such as for teams and projects */
  namespace: string;
};
export type IoK8SApimachineryPkgApisMetaV1Time = string;
export type IoK8SApimachineryPkgApisMetaV1FieldsV1 = object;
export type IoK8SApimachineryPkgApisMetaV1ManagedFieldsEntry = {
  /** APIVersion defines the version of this resource that this field set applies to. The format is "group/version" just like the top-level APIVersion field. It is necessary to track the version of a field set because it cannot be automatically converted. */
  apiVersion?: string;
  /** FieldsType is the discriminator for the different fields format and version. There is currently only one possible value: "FieldsV1" */
  fieldsType?: string;
  /** FieldsV1 holds the first JSON version format as described in the "FieldsV1" type. */
  fieldsV1?: IoK8SApimachineryPkgApisMetaV1FieldsV1;
  /** Manager is an identifier of the workflow managing these fields. */
  manager?: string;
  /** Operation is the type of operation which lead to this ManagedFieldsEntry being created. The only valid values for this field are 'Apply' and 'Update'. */
  operation?: string;
  /** Subresource is the name of the subresource used to update that object, or empty string if the object was updated through the main resource. The value of this field is used to distinguish between managers, even if they share the same name. For example, a status update will be distinct from a regular update using the same manager name. Note that the APIVersion field is not related to the Subresource field and it always corresponds to the version of the main resource. */
  subresource?: string;
  /** Time is the timestamp of when the ManagedFields entry was added. The timestamp will also be updated if a field is added, the manager changes any of the owned fields value or removes a field. The timestamp does not update when a field is removed from the entry because another manager took it over. */
  time?: IoK8SApimachineryPkgApisMetaV1Time;
};
export type IoK8SApimachineryPkgApisMetaV1OwnerReference = {
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
export type IoK8SApimachineryPkgApisMetaV1ObjectMeta = {
  /** Annotations is an unstructured key value map stored with a resource that may be set by external tools to store and retrieve arbitrary metadata. They are not queryable and should be preserved when modifying objects. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations */
  annotations?: {
    [key: string]: string;
  };
  /** CreationTimestamp is a timestamp representing the server time when this object was created. It is not guaranteed to be set in happens-before order across separate operations. Clients may not set this value. It is represented in RFC3339 form and is in UTC.
    
    Populated by the system. Read-only. Null for lists. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata */
  creationTimestamp?: IoK8SApimachineryPkgApisMetaV1Time;
  /** Number of seconds allowed for this object to gracefully terminate before it will be removed from the system. Only set when deletionTimestamp is also set. May only be shortened. Read-only. */
  deletionGracePeriodSeconds?: number;
  /** DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This field is set by the server when a graceful deletion is requested by the user, and is not directly settable by a client. The resource is expected to be deleted (no longer visible from resource lists, and not reachable by name) after the time in this field, once the finalizers list is empty. As long as the finalizers list contains items, deletion is blocked. Once the deletionTimestamp is set, this value may not be unset or be set further into the future, although it may be shortened or the resource may be deleted prior to this time. For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react by sending a graceful termination signal to the containers in the pod. After that 30 seconds, the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup, remove the pod from the API. In the presence of network partitions, this object may still exist after this timestamp, until an administrator or automated process can determine the resource is fully terminated. If not set, graceful deletion of the object has not been requested.
    
    Populated by the system when a graceful deletion is requested. Read-only. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata */
  deletionTimestamp?: IoK8SApimachineryPkgApisMetaV1Time;
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
  managedFields?: IoK8SApimachineryPkgApisMetaV1ManagedFieldsEntry[];
  /** Name must be unique within a namespace. Is required when creating resources, although some resources may allow a client to request the generation of an appropriate name automatically. Name is primarily intended for creation idempotence and configuration definition. Cannot be updated. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names */
  name?: string;
  /** Namespace defines the space within which each name must be unique. An empty namespace is equivalent to the "default" namespace, but "default" is the canonical representation. Not all objects are required to be scoped to a namespace - the value of this field for those objects will be empty.
    
    Must be a DNS_LABEL. Cannot be updated. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces */
  namespace?: string;
  /** List of objects depended by this object. If ALL objects in the list have been deleted, this object will be garbage collected. If this object is managed by a controller, then an entry in this list will point to this controller, with the controller field set to true. There cannot be more than one managing controller. */
  ownerReferences?: IoK8SApimachineryPkgApisMetaV1OwnerReference[];
  /** An opaque value that represents the internal version of this object that can be used by clients to determine when objects have changed. May be used for optimistic concurrency, change detection, and the watch operation on a resource or set of resources. Clients must treat these values as opaque and passed unmodified back to the server. They may only be valid for a particular resource or set of resources.
    
    Populated by the system. Read-only. Value must be treated as opaque by clients and . More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency */
  resourceVersion?: string;
  /** Deprecated: selfLink is a legacy read-only field that is no longer populated by the system. */
  selfLink?: string;
  /** UID is the unique in time and space value for this object. It is typically generated by the server on successful creation of a resource and is not allowed to change on PUT operations.
    
    Populated by the system. Read-only. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#uids */
  uid?: string;
};
export type ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1JobSpec = {
  /** Possible enum values:
     - `"export"` Export from grafana into the remote repository
     - `"pr"` Update a pull request -- send preview images, links etc
     - `"sync"` Sync the remote branch with the grafana instance */
  action: 'export' | 'pr' | 'sync';
  hash?: string;
  /** Pull request number (when appropriate) */
  pr?: number;
  /** The branch of commit hash */
  ref?: string;
  /** URL to the originator (eg, PR URL) */
  url?: string;
};
export type ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1JobStatus = {
  errors?: string[];
  finished?: number;
  message?: string;
  started?: number;
  /** Possible enum values:
     - `"error"` Finished with errors
     - `"pending"` Job has been submitted, but not processed yet
     - `"success"` Finished with success
     - `"working"` The job is running */
  state?: 'error' | 'pending' | 'success' | 'working';
};
export type ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1Job = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  metadata?: IoK8SApimachineryPkgApisMetaV1ObjectMeta;
  spec?: ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1JobSpec;
  status?: ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1JobStatus;
};
export type IoK8SApimachineryPkgApisMetaV1ListMeta = {
  /** continue may be set if the user set a limit on the number of items returned, and indicates that the server has more data available. The value is opaque and may be used to issue another request to the endpoint that served this list to retrieve the next set of available objects. Continuing a consistent list may not be possible if the server configuration has changed or more than a few minutes have passed. The resourceVersion field returned when using this continue value will be identical to the value in the first response, unless you have received this token from an error message. */
  continue?: string;
  /** remainingItemCount is the number of subsequent items in the list which are not included in this list response. If the list request contained label or field selectors, then the number of remaining items is unknown and the field will be left unset and omitted during serialization. If the list is complete (either because it is not chunking or because this is the last chunk), then there are no more remaining items and this field will be left unset and omitted during serialization. Servers older than v1.15 do not set this field. The intended use of the remainingItemCount is *estimating* the size of a collection. Clients should not rely on the remainingItemCount to be set or to be exact. */
  remainingItemCount?: number;
  /** String that identifies the server's internal version of this object that can be used by clients to determine when objects have changed. Value must be treated as opaque by clients and passed unmodified back to the server. Populated by the system. Read-only. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency */
  resourceVersion?: string;
  /** Deprecated: selfLink is a legacy read-only field that is no longer populated by the system. */
  selfLink?: string;
};
export type ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1JobList = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  items?: ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1Job[];
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  metadata?: IoK8SApimachineryPkgApisMetaV1ListMeta;
};
export type ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1EditingOptions = {
  /** End users can create new files in the remote file system */
  create: boolean;
  /** End users can delete existing files in the remote file system */
  delete: boolean;
  /** End users can update existing files in the remote file system */
  update: boolean;
};
export type ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1GitHubRepositoryConfig = {
  /** The branch to use in the repository. By default, this is the main branch. */
  branch?: string;
  /** Whether we should commit to change branches and use a Pull Request flow to achieve this. By default, this is false (i.e. we will commit straight to the main branch). */
  branchWorkflow?: boolean;
  /** Whether we should show dashboard previews in the pull requests caused by the BranchWorkflow option. By default, this is false (i.e. we will not create previews). This option is a no-op if BranchWorkflow is `false` or default. */
  generateDashboardPreviews?: boolean;
  /** The owner of the repository (e.g. example in `example/test` or `https://github.com/example/test`). */
  owner?: string;
  /** PullRequestLinter enables the dashboard linter for this repository in Pull Requests */
  pullRequestLinter?: boolean;
  /** The name of the repository (e.g. test in `example/test` or `https://github.com/example/test`). */
  repository?: string;
  /** Token for accessing the repository. */
  token?: string;
  /** WebhookSecret is the secret used to validate incoming webhooks. */
  webhookSecret?: string;
  /** WebhookURL is the URL to send webhooks events to. By default, the system will generate a URL for you but you can use this one to run grafana locally and test the webhooks. */
  webhookURL?: string;
};
export type ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1LocalRepositoryConfig = {
  path?: string;
};
export type ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1S3RepositoryConfig = {
  bucket?: string;
  region?: string;
};
export type ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1RepositorySpec = {
  /** Describe the feature toggle */
  description?: string;
  /** Edit options within the repository */
  editing: ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1EditingOptions;
  /** The folder that is backed by the repository. The value is a reference to the Kubernetes metadata name of the folder in the same namespace. */
  folder?: string;
  /** The repository on GitHub. Mutually exclusive with local and s3. */
  github?: ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1GitHubRepositoryConfig;
  /** Linting enables linting for this repository */
  linting?: boolean;
  /** The repository on the local file system. Mutually exclusive with s3 and github. */
  local?: ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1LocalRepositoryConfig;
  /** Should we prefer emitting YAML for this repository, e.g. upon export? Editing existing dashboards will continue to emit the file format used in the repository. (TODO: implement this) If you delete and then recreate a dashboard, it will switch to the preferred format. */
  preferYaml?: boolean;
  /** The repository in an S3 bucket. Mutually exclusive with local and github. */
  s3?: ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1S3RepositoryConfig;
  /** Describe the feature toggle */
  title: string;
  /** The repository type.  When selected oneOf the values below should be non-nil
    
    Possible enum values:
     - `"github"`
     - `"local"`
     - `"s3"` */
  type: 'github' | 'local' | 's3';
};
export type ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1HealthStatus = {
  /** When the sync job started */
  checked?: number;
  /** When not healthy, requests will not be executed */
  healthy: boolean;
  /** Summary messages (will be shown to users) */
  message?: string[];
};
export type ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1SyncStatus = {
  /** When the sync job finished */
  finished?: number;
  /** The repository hash when the last sync ran */
  hash?: string;
  /** The ID for the job that ran this sync */
  job?: string;
  /** Summary messages (will be shown to users) */
  message?: string[];
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
export type ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1RepositoryStatus = {
  /** This will get updated with the current health status (and updated periodically) */
  health: ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1HealthStatus;
  /** Sync information */
  sync: ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1SyncStatus;
};
export type ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1Repository = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  metadata?: IoK8SApimachineryPkgApisMetaV1ObjectMeta;
  spec?: ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1RepositorySpec;
  status?: ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1RepositoryStatus;
};
export type ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1RepositoryList = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  items?: ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1Repository[];
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  metadata?: IoK8SApimachineryPkgApisMetaV1ListMeta;
};
export type IoK8SApimachineryPkgApisMetaV1StatusCause = {
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
export type IoK8SApimachineryPkgApisMetaV1StatusDetails = {
  /** The Causes array includes more details associated with the StatusReason failure. Not all StatusReasons may provide detailed causes. */
  causes?: IoK8SApimachineryPkgApisMetaV1StatusCause[];
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
export type IoK8SApimachineryPkgApisMetaV1Status = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  /** Suggested HTTP return code for this status, 0 if not set. */
  code?: number;
  /** Extended data associated with the reason.  Each reason may define its own extended details. This field is optional and the data returned is not guaranteed to conform to any schema except that defined by the reason type. */
  details?: IoK8SApimachineryPkgApisMetaV1StatusDetails;
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  /** A human-readable description of the status of this operation. */
  message?: string;
  /** Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  metadata?: IoK8SApimachineryPkgApisMetaV1ListMeta;
  /** A machine-readable description of why this operation is in the "Failure" status. If this value is empty there is no information available. A Reason clarifies an HTTP status code but does not override it. */
  reason?: string;
  /** Status of the operation. One of: "Success" or "Failure". More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status */
  status?: string;
};
export type IoK8SApimachineryPkgApisMetaV1Preconditions = {
  /** Specifies the target ResourceVersion */
  resourceVersion?: string;
  /** Specifies the target UID. */
  uid?: string;
};
export type IoK8SApimachineryPkgApisMetaV1DeleteOptions = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  /** When present, indicates that modifications should not be persisted. An invalid or unrecognized dryRun directive will result in an error response and no further processing of the request. Valid values are: - All: all dry run stages will be processed */
  dryRun?: string[];
  /** The duration in seconds before the object should be deleted. Value must be non-negative integer. The value zero indicates delete immediately. If this value is nil, the default grace period for the specified type will be used. Defaults to a per object value if not specified. zero means delete immediately. */
  gracePeriodSeconds?: number;
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  /** Deprecated: please use the PropagationPolicy, this field will be deprecated in 1.7. Should the dependent objects be orphaned. If true/false, the "orphan" finalizer will be added to/removed from the object's finalizers list. Either this field or PropagationPolicy may be set, but not both. */
  orphanDependents?: boolean;
  /** Must be fulfilled before a deletion is carried out. If not possible, a 409 Conflict status will be returned. */
  preconditions?: IoK8SApimachineryPkgApisMetaV1Preconditions;
  /** Whether and how garbage collection will be performed. Either this field or OrphanDependents may be set, but not both. The default policy is decided by the existing finalizer set in the metadata.finalizers and the resource-specific default policy. Acceptable values are: 'Orphan' - orphan the dependents; 'Background' - allow the garbage collector to delete the dependents in the background; 'Foreground' - a cascading policy that deletes all dependents in the foreground. */
  propagationPolicy?: string;
};
export type IoK8SApimachineryPkgApisMetaV1Patch = object;
export type ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1LintIssue = {
  message: string;
  rule: string;
  /** Possible enum values:
     - `"error"`
     - `"exclude"`
     - `"fixed"`
     - `"quiet"`
     - `"warning"` */
  severity: 'error' | 'exclude' | 'fixed' | 'quiet' | 'warning';
};
export type ComGithubGrafanaGrafanaPkgApimachineryApisCommonV0Alpha1Unstructured = {
  [key: string]: any;
};
export type ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1ResourceType = {
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
export type ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1ResourceObjects = {
  /** The action required/used for dryRun
    
    Possible enum values:
     - `"create"`
     - `"delete"`
     - `"update"` */
  action?: 'create' | 'delete' | 'update';
  /** The value returned from a dryRun request */
  dryRun?: ComGithubGrafanaGrafanaPkgApimachineryApisCommonV0Alpha1Unstructured;
  /** The same value, currently saved in the grafana database */
  existing?: ComGithubGrafanaGrafanaPkgApimachineryApisCommonV0Alpha1Unstructured;
  /** The resource from the repository with all modifications applied eg, the name, folder etc will all be applied to this object */
  file?: ComGithubGrafanaGrafanaPkgApimachineryApisCommonV0Alpha1Unstructured;
  /** The identified type for this object */
  type: ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1ResourceType;
};
export type ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1ResourceWrapper = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  /** If errors exist, show them here */
  errors?: string[];
  /** The repo hash value */
  hash?: string;
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  /** Lint results */
  lint?: ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1LintIssue[];
  /** Path to the remote file */
  path?: string;
  /** The commit hash (if exists) */
  ref?: string;
  /** Different flavors of the same object */
  resource: ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1ResourceObjects;
  /** The modified time in the remote file system */
  timestamp?: IoK8SApimachineryPkgApisMetaV1Time;
};
export type ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1TestResults = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  /** HTTP status code */
  code: number;
  /** Optional details */
  details?: ComGithubGrafanaGrafanaPkgApimachineryApisCommonV0Alpha1Unstructured;
  /** Error descriptions */
  errors?: string[];
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  /** Is the connection healthy */
  success: boolean;
};
export type ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1WebhookResponse = {
  /** Optional message */
  added?: string;
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  /** HTTP Status code 200 implies that the payload was understood but nothing is required 202 implies that an async job has been scheduled to handle the request */
  code?: number;
  /** Jobs to be processed When the response is 202 (Accepted) the queued jobs will be returned */
  job?: ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1JobSpec;
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
};
export const {
  useListNamespacedJobQuery,
  useReadNamespacedJobQuery,
  useListNamespacedRepositoryQuery,
  useCreateNamespacedRepositoryMutation,
  useReadNamespacedRepositoryQuery,
  useReplaceNamespacedRepositoryMutation,
  useDeleteNamespacedRepositoryMutation,
  usePatchNamespacedRepositoryMutation,
  useConnectPostNamespacedRepositoryExportMutation,
  useConnectGetNamespacedRepositoryFilesQuery,
  useConnectGetNamespacedRepositoryFilesWithPathQuery,
  useConnectPutNamespacedRepositoryFilesWithPathMutation,
  useConnectPostNamespacedRepositoryFilesWithPathMutation,
  useConnectDeleteNamespacedRepositoryFilesWithPathMutation,
  useConnectGetNamespacedRepositoryHistoryQuery,
  useConnectGetNamespacedRepositoryHistoryWithPathQuery,
  useReadNamespacedRepositoryStatusQuery,
  useReplaceNamespacedRepositoryStatusMutation,
  usePatchNamespacedRepositoryStatusMutation,
  useConnectPostNamespacedRepositorySyncMutation,
  useConnectPostNamespacedRepositoryTestMutation,
  useConnectGetNamespacedRepositoryWebhookQuery,
  useConnectPostNamespacedRepositoryWebhookMutation,
} = injectedRtkApi;
