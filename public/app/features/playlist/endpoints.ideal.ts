import { Resource, ResourceList } from '../apiserver/types';

import { baseAPI as api } from './baseAPI';

// in baseAPI.ts, we configure a baseQuery with:
// baseURL: `/apis/playlist.grafana.app/v0alpha1/namespaces/${config.namespace}`

const injectedRtkApi = api.injectEndpoints({
  endpoints: (build) => ({
    // If the base url contains the namespace, that doesn't allow us to specify the `getApiResources` endpoint...

    listPlaylists: build.query<ListPlaylistApiResponse, ListPlaylistApiArg>({
      query: (queryArg) => ({
        url: '/playlists',
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

    createPlaylist: build.mutation<CreatePlaylistApiResponse, CreatePlaylistApiArg>({
      query: (queryArg) => ({
        url: `/playlists`,
        method: 'POST',
        body: queryArg.comGithubGrafanaGrafanaPkgApisPlaylistV0Alpha1Playlist,
        params: {
          pretty: queryArg.pretty,
          dryRun: queryArg.dryRun,
          fieldManager: queryArg.fieldManager,
          fieldValidation: queryArg.fieldValidation,
        },
      }),
    }),
  }),
  overrideExisting: false,
});

export { injectedRtkApi as generatedAPI };

///
// Core resource types
///
export type ComGithubGrafanaGrafanaPkgApisPlaylistV0Alpha1Spec = {
  /** Interval sets the time between switching views in a playlist. */
  interval: string;
  /** The ordered list of items that the playlist will iterate over. */
  items?: ComGithubGrafanaGrafanaPkgApisPlaylistV0Alpha1Item[];
  /** Name of the playlist. */
  title: string;
};

export type ComGithubGrafanaGrafanaPkgApisPlaylistV0Alpha1Item = {
  /** Type of the item.
   
    Possible enum values:
     - `"dashboard_by_id"` Deprecated -- should use UID
     - `"dashboard_by_tag"`
     - `"dashboard_by_uid"` */
  type: 'dashboard_by_id' | 'dashboard_by_tag' | 'dashboard_by_uid';
  /** Value depends on type and describes the playlist item.
   
     - dashboard_by_id: The value is an internal numerical identifier set by Grafana. This
     is not portable as the numerical identifier is non-deterministic between different instances.
     Will be replaced by dashboard_by_uid in the future. (deprecated)
     - dashboard_by_tag: The value is a tag which is set on any number of dashboards. All
     dashboards behind the tag will be added to the playlist.
     - dashboard_by_uid: The value is the dashboard UID */
  value: string;
};

///
// API Requests
///
export type ListPlaylistApiArg = {
  /** object name and auth scope, such as for teams and projects */
  // namespace: string;

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

export type CreatePlaylistApiArg = {
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

  comGithubGrafanaGrafanaPkgApisPlaylistV0Alpha1Playlist: ComGithubGrafanaGrafanaPkgApisPlaylistV0Alpha1Playlist;
};

///
// API Responses
///
type ListPlaylistApiResponse = ResourceList<ComGithubGrafanaGrafanaPkgApisPlaylistV0Alpha1Spec, 'playlist'>;
type CreatePlaylistApiResponse = Resource<ComGithubGrafanaGrafanaPkgApisPlaylistV0Alpha1Spec, 'playlist'>;

export const { useListPlaylistsQuery, useCreatePlaylistMutation } = injectedRtkApi;
