import { api } from './api';
export const addTagTypes = ['API Discovery', 'Receiver'] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      getApiResources: build.query<GetApiResourcesApiResponse, GetApiResourcesApiArg>({
        query: () => ({ url: `/apis/notifications.alerting.grafana.app/v0alpha2/` }),
        providesTags: ['API Discovery'],
      }),
      listReceiver: build.query<ListReceiverApiResponse, ListReceiverApiArg>({
        query: (queryArg) => ({
          url: `/apis/notifications.alerting.grafana.app/v0alpha2/namespaces/${queryArg['namespace']}/receivers`,
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
        providesTags: ['Receiver'],
      }),
      createReceiver: build.mutation<CreateReceiverApiResponse, CreateReceiverApiArg>({
        query: (queryArg) => ({
          url: `/apis/notifications.alerting.grafana.app/v0alpha2/namespaces/${queryArg['namespace']}/receivers`,
          method: 'POST',
          body: queryArg.comGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2Receiver,
          params: {
            pretty: queryArg.pretty,
            dryRun: queryArg.dryRun,
            fieldManager: queryArg.fieldManager,
            fieldValidation: queryArg.fieldValidation,
          },
        }),
        invalidatesTags: ['Receiver'],
      }),
      deletecollectionReceiver: build.mutation<DeletecollectionReceiverApiResponse, DeletecollectionReceiverApiArg>({
        query: (queryArg) => ({
          url: `/apis/notifications.alerting.grafana.app/v0alpha2/namespaces/${queryArg['namespace']}/receivers`,
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
        invalidatesTags: ['Receiver'],
      }),
      getReceiver: build.query<GetReceiverApiResponse, GetReceiverApiArg>({
        query: (queryArg) => ({
          url: `/apis/notifications.alerting.grafana.app/v0alpha2/namespaces/${queryArg['namespace']}/receivers/${queryArg.name}`,
          params: {
            pretty: queryArg.pretty,
          },
        }),
        providesTags: ['Receiver'],
      }),
      replaceReceiver: build.mutation<ReplaceReceiverApiResponse, ReplaceReceiverApiArg>({
        query: (queryArg) => ({
          url: `/apis/notifications.alerting.grafana.app/v0alpha2/namespaces/${queryArg['namespace']}/receivers/${queryArg.name}`,
          method: 'PUT',
          body: queryArg.comGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2Receiver,
          params: {
            pretty: queryArg.pretty,
            dryRun: queryArg.dryRun,
            fieldManager: queryArg.fieldManager,
            fieldValidation: queryArg.fieldValidation,
          },
        }),
        invalidatesTags: ['Receiver'],
      }),
      deleteReceiver: build.mutation<DeleteReceiverApiResponse, DeleteReceiverApiArg>({
        query: (queryArg) => ({
          url: `/apis/notifications.alerting.grafana.app/v0alpha2/namespaces/${queryArg['namespace']}/receivers/${queryArg.name}`,
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
        invalidatesTags: ['Receiver'],
      }),
      updateReceiver: build.mutation<UpdateReceiverApiResponse, UpdateReceiverApiArg>({
        query: (queryArg) => ({
          url: `/apis/notifications.alerting.grafana.app/v0alpha2/namespaces/${queryArg['namespace']}/receivers/${queryArg.name}`,
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
        invalidatesTags: ['Receiver'],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as alertingAPI };
export type GetApiResourcesApiResponse = /** status 200 OK */ IoK8SApimachineryPkgApisMetaV1ApiResourceList;
export type GetApiResourcesApiArg = void;
export type ListReceiverApiResponse =
  /** status 200 OK */ ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2ReceiverList;
export type ListReceiverApiArg = {
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
export type CreateReceiverApiResponse = /** status 200 OK */
  | ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2Receiver
  | /** status 201 Created */ ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2Receiver
  | /** status 202 Accepted */ ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2Receiver;
export type CreateReceiverApiArg = {
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
  comGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2Receiver: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2Receiver;
};
export type DeletecollectionReceiverApiResponse = /** status 200 OK */ IoK8SApimachineryPkgApisMetaV1Status;
export type DeletecollectionReceiverApiArg = {
  /** object name and auth scope, such as for teams and projects */
  namespace: string;
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
export type GetReceiverApiResponse =
  /** status 200 OK */ ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2Receiver;
export type GetReceiverApiArg = {
  /** name of the Receiver */
  name: string;
  /** object name and auth scope, such as for teams and projects */
  namespace: string;
  /** If 'true', then the output is pretty printed. Defaults to 'false' unless the user-agent indicates a browser or command-line HTTP tool (curl and wget). */
  pretty?: string;
};
export type ReplaceReceiverApiResponse = /** status 200 OK */
  | ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2Receiver
  | /** status 201 Created */ ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2Receiver;
export type ReplaceReceiverApiArg = {
  /** name of the Receiver */
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
  comGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2Receiver: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2Receiver;
};
export type DeleteReceiverApiResponse = /** status 200 OK */
  | IoK8SApimachineryPkgApisMetaV1Status
  | /** status 202 Accepted */ IoK8SApimachineryPkgApisMetaV1Status;
export type DeleteReceiverApiArg = {
  /** name of the Receiver */
  name: string;
  /** object name and auth scope, such as for teams and projects */
  namespace: string;
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
export type UpdateReceiverApiResponse = /** status 200 OK */
  | ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2Receiver
  | /** status 201 Created */ ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2Receiver;
export type UpdateReceiverApiArg = {
  /** name of the Receiver */
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
export type IoK8SApimachineryPkgApisMetaV1ApiResource = {
  /** categories is a list of the grouped resources this resource belongs to (e.g. 'all') */
  categories?: string[];
  /** group is the preferred group of the resource.  Empty implies the group of the containing resource list. For subresources, this may have a different value, for example: Scale". */
  group?: string;
  /** kind is the kind for the resource (e.g. 'Foo' is the kind for a resource 'foo') */
  kind: string;
  /** name is the plural name of the resource. */
  name: string;
  /** namespaced indicates if a resource is namespaced or not. */
  namespaced: boolean;
  /** shortNames is a list of suggested short names of the resource. */
  shortNames?: string[];
  /** singularName is the singular name of the resource.  This allows clients to handle plural and singular opaquely. The singularName is more correct for reporting status on a single item and both singular and plural are allowed from the kubectl CLI interface. */
  singularName: string;
  /** The hash value of the storage version, the version this resource is converted to when written to the data store. Value must be treated as opaque by clients. Only equality comparison on the value is valid. This is an alpha feature and may change or be removed in the future. The field is populated by the apiserver only if the StorageVersionHash feature gate is enabled. This field will remain optional even if it graduates. */
  storageVersionHash?: string;
  /** verbs is a list of supported kube verbs (this includes get, list, watch, create, update, patch, delete, deletecollection, and proxy) */
  verbs: string[];
  /** version is the preferred version of the resource.  Empty implies the version of the containing resource list For subresources, this may have a different value, for example: v1 (while inside a v1beta1 version of the core resource's group)". */
  version?: string;
};
export type IoK8SApimachineryPkgApisMetaV1ApiResourceList = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  /** groupVersion is the group and version this APIResourceList is for. */
  groupVersion: string;
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  /** resources contains the name of the resources and if they are namespaced. */
  resources: IoK8SApimachineryPkgApisMetaV1ApiResource[];
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
export type ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2AlertmanagerIntegration = {
  basicAuthPassword?: string;
  basicAuthUser?: string;
  disable_resolve_message?: boolean;
  uid?: string;
  url: string;
};
export type ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2DingdingIntegration = {
  disable_resolve_message?: boolean;
  message?: string;
  msgType?: string;
  title?: string;
  uid?: string;
  url?: string;
};
export type ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2DiscordIntegration = {
  avatar_url?: string;
  disable_resolve_message?: boolean;
  message?: string;
  title?: string;
  uid?: string;
  url: string;
  use_discord_username?: boolean;
};
export type ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2EmailIntegration = {
  addresses: string[];
  disable_resolve_message?: boolean;
  message?: string;
  singleEmail?: boolean;
  subject?: string;
  uid?: string;
};
export type ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2GooglechatIntegration = {
  disable_resolve_message?: boolean;
  message?: string;
  title?: string;
  uid?: string;
  url: string;
};
export type ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2JiraIntegration = {
  api_token?: string;
  api_url: string;
  dedup_key_field?: string;
  description?: string;
  disable_resolve_message?: boolean;
  fields?: object;
  issue_type: string;
  labels?: string[];
  password?: string;
  priority?: string;
  project: string;
  reopen_duration?: string;
  reopen_transition?: string;
  resolve_transition?: string;
  summary?: string;
  uid?: string;
  user?: string;
  wont_fix_resolution?: string;
};
export type ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2KafkaIntegration = {
  apiVersion?: string;
  description?: string;
  details?: string;
  disable_resolve_message?: boolean;
  kafkaClusterId?: string;
  kafkaRestProxy: string;
  kafkaTopic: string;
  password?: string;
  uid?: string;
  username?: string;
};
export type ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2LineIntegration = {
  description?: string;
  disable_resolve_message?: boolean;
  title?: string;
  token: string;
  uid?: string;
};
export type ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2TlsConfig = {
  caCertificate?: string;
  clientCertificate?: string;
  clientKey?: string;
  insecureSkipVerify?: boolean;
};
export type ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2MqttIntegration = {
  brokerUrl?: string;
  clientId?: string;
  disable_resolve_message?: boolean;
  message?: string;
  messageFormat?: string;
  password?: string;
  qos?: number;
  retain?: boolean;
  tlsConfig?: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2TlsConfig;
  topic?: string;
  uid?: string;
  username?: string;
};
export type ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2OnCallIntegration = {
  authorization_credentials?: string;
  authorization_scheme?: string;
  disable_resolve_message?: boolean;
  httpMethod?: string;
  maxAlerts?: number;
  message?: string;
  password?: string;
  title?: string;
  uid?: string;
  url: string;
  username?: string;
};
export type ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2OpsgenieIntegrationResponder = {
  id?: string;
  name?: string;
  type: string;
  username?: string;
};
export type ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2OpsgenieIntegration = {
  apiKey: string;
  apiUrl?: string;
  autoClose?: boolean;
  description?: string;
  disable_resolve_message?: boolean;
  message?: string;
  overridePriority?: boolean;
  responders?: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2OpsgenieIntegrationResponder[];
  sendTagsAs?: string;
  uid?: string;
};
export type ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2PagerdutyIntegration = {
  class?: string;
  client?: string;
  client_url?: string;
  component?: string;
  details?: {
    [key: string]: string;
  };
  disable_resolve_message?: boolean;
  group?: string;
  integrationKey: string;
  severity?: string;
  source?: string;
  summary?: string;
  uid?: string;
  url?: string;
};
export type ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2PushoverIntegration = {
  apiToken: string;
  device?: string;
  disable_resolve_message?: boolean;
  expire?: number;
  message?: string;
  okPriority?: number;
  okSound?: string;
  priority?: number;
  retry?: number;
  sound?: string;
  title?: string;
  uid?: string;
  uploadImage?: boolean;
  userKey: string;
};
export type ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2SensugoIntegration = {
  apikey: string;
  check?: string;
  disable_resolve_message?: boolean;
  entity?: string;
  handler?: string;
  message?: string;
  namespace?: string;
  uid?: string;
  url: string;
};
export type ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2SlackIntegration = {
  color?: string;
  disable_resolve_message?: boolean;
  endpointUrl?: string;
  icon_emoji?: string;
  icon_url?: string;
  mentionChannel?: string;
  mentionGroups?: string;
  mentionUsers?: string;
  recipient?: string;
  text?: string;
  title?: string;
  token?: string;
  uid?: string;
  url?: string;
  username?: string;
};
export type ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2SigV4Config = {
  access_key?: string;
  profile?: string;
  region?: string;
  role_arn?: string;
  secret_key?: string;
};
export type ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2SnsIntegration = {
  api_url?: string;
  attributes?: {
    [key: string]: string;
  };
  disable_resolve_message?: boolean;
  message?: string;
  phone_number?: string;
  sigv4: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2SigV4Config;
  subject?: string;
  target_arn?: string;
  topic_arn?: string;
  uid?: string;
};
export type ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2TeamsIntegration = {
  disable_resolve_message?: boolean;
  message?: string;
  sectiontitle?: string;
  title?: string;
  uid?: string;
  url: string;
};
export type ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2TelegramIntegration = {
  bottoken: string;
  chatid: string;
  disable_notifications?: boolean;
  disable_resolve_message?: boolean;
  disable_web_page_preview?: boolean;
  message?: string;
  message_thread_id: string;
  parse_mode?: string;
  protect_content?: boolean;
  uid?: string;
};
export type ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2ThreemaIntegration = {
  api_secret: string;
  description?: string;
  disable_resolve_message?: boolean;
  gateway_id: string;
  recipient_id: string;
  title?: string;
  uid?: string;
};
export type ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2VictoropsIntegration = {
  description?: string;
  disable_resolve_message?: boolean;
  messageType?: string;
  title?: string;
  uid?: string;
  url: string;
};
export type ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2WebexIntegration = {
  api_url?: string;
  bot_token: string;
  disable_resolve_message?: boolean;
  message?: string;
  room_id?: string;
  uid?: string;
};
export type ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2HmacConfig = {
  header: string;
  secret?: string;
  timestampHeader: string;
};
export type ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2CustomPayload = {
  template?: string;
  vars?: {
    [key: string]: string;
  };
};
export type ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2WebhookIntegration = {
  authorization_credentials?: string;
  authorization_scheme?: string;
  disable_resolve_message?: boolean;
  headers?: {
    [key: string]: string;
  };
  hmacConfig?: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2HmacConfig;
  httpMethod?: string;
  maxAlerts?: number;
  message?: string;
  password?: string;
  payload?: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2CustomPayload;
  title?: string;
  tlsConfig?: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2TlsConfig;
  uid?: string;
  url: string;
  username?: string;
};
export type ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2WecomIntegration = {
  agent_id?: string;
  corp_id?: string;
  disable_resolve_message?: boolean;
  endpointUrl?: string;
  message?: string;
  msgtype?: string;
  secret?: string;
  title?: string;
  touser?: string;
  uid?: string;
  url?: string;
};
export type ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2V0Alpha2SpecIntegrations = {
  alertmanager?: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2AlertmanagerIntegration[];
  dingding?: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2DingdingIntegration[];
  discord?: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2DiscordIntegration[];
  email?: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2EmailIntegration[];
  googlechat?: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2GooglechatIntegration[];
  jira?: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2JiraIntegration[];
  kafka?: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2KafkaIntegration[];
  line?: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2LineIntegration[];
  mqtt?: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2MqttIntegration[];
  oncall?: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2OnCallIntegration[];
  opsgenie?: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2OpsgenieIntegration[];
  pagerduty?: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2PagerdutyIntegration[];
  pushover?: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2PushoverIntegration[];
  sensugo?: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2SensugoIntegration[];
  slack?: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2SlackIntegration[];
  sns?: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2SnsIntegration[];
  teams?: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2TeamsIntegration[];
  telegram?: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2TelegramIntegration[];
  threema?: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2ThreemaIntegration[];
  victorops?: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2VictoropsIntegration[];
  webex?: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2WebexIntegration[];
  webhook?: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2WebhookIntegration[];
  wecom?: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2WecomIntegration[];
};
export type ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2Spec = {
  integrations: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2V0Alpha2SpecIntegrations;
  title: string;
};
export type ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2StatusOperatorState = {
  /** descriptiveState is an optional more descriptive state field which has no requirements on format */
  descriptiveState?: string;
  /** details contains any extra information that is operator-specific */
  details?: {
    [key: string]: object;
  };
  /** lastEvaluation is the ResourceVersion last evaluated */
  lastEvaluation: string;
  /** state describes the state of the lastEvaluation. It is limited to three possible states for machine evaluation. */
  state: string;
};
export type ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2Status = {
  /** additionalFields is reserved for future use */
  additionalFields?: {
    [key: string]: object;
  };
  /** operatorStates is a map of operator ID to operator state evaluations. Any operator which consumes this kind SHOULD add its state evaluation information to this field. */
  operatorStates?: {
    [key: string]: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2StatusOperatorState;
  };
};
export type ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2Receiver = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  metadata: IoK8SApimachineryPkgApisMetaV1ObjectMeta;
  /** Spec is the spec of the Receiver */
  spec: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2Spec;
  status: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2Status;
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
export type ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2ReceiverList = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  items: ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisReceiverV0Alpha2Receiver[];
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  metadata: IoK8SApimachineryPkgApisMetaV1ListMeta;
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
export type IoK8SApimachineryPkgApisMetaV1Patch = object;
