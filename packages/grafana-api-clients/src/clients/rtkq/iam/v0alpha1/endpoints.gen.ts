import { api } from './baseAPI';
export const addTagTypes = ['Display'] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      getDisplayMapping: build.query<GetDisplayMappingApiResponse, GetDisplayMappingApiArg>({
        query: (queryArg) => ({
          url: `/display`,
          params: {
            key: queryArg.key,
          },
        }),
        providesTags: ['Display'],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as generatedAPI };
export type GetDisplayMappingApiResponse = /** status 200 undefined */ DisplayList;
export type GetDisplayMappingApiArg = {
  /** Display keys */
  key: string[];
};
export type IdentityRef = {
  /** Name is the unique identifier for identity, guaranteed to be a unique value for the type within a namespace. */
  name: string;
  /** Type of identity e.g. "user". For a full list see https://github.com/grafana/authlib/blob/d6737a7dc8f55e9d42834adb83b5da607ceed293/types/type.go#L15 */
  type: string;
};
export type Display = {
  /** AvatarURL is the url where we can get the avatar for identity */
  avatarURL?: string;
  /** Display name for identity. */
  displayName: string;
  identity: IdentityRef;
  /** InternalID is the legacy numeric id for identity, Deprecated: use the identityRef where possible */
  internalId?: number;
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
export type DisplayList = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  /** Matching items (the caller may need to remap from keys to results) */
  display: Display[];
  /** Input keys that were not useable */
  invalidKeys?: string[];
  /** Request keys used to lookup the display value */
  keys: string[];
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  metadata?: ListMeta;
};
