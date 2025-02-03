import { iamApi as api } from './api';
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
export { injectedRtkApi as generatedIamApi };
export type GetDisplayMappingApiResponse = /** status 200 undefined */ {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  /** Matching items (the caller may need to remap from keys to results) */
  display: {
    /** AvatarURL is the url where we can get the avatar for identity */
    avatarURL?: string;
    /** Display name for identity. */
    displayName: string;
    identity: {
      /** Name is the unique identifier for identity, guaranteed to be a unique value for the type within a namespace. */
      name: string;
      /** Type of identity e.g. "user". For a full list see https://github.com/grafana/authlib/blob/d6737a7dc8f55e9d42834adb83b5da607ceed293/types/type.go#L15 */
      type: string;
    };
    /** InternalID is the legacy numeric id for identity, Deprecated: use the identityRef where possible */
    internalId?: number;
  }[];
  /** Input keys that were not useable */
  invalidKeys?: string[];
  /** Request keys used to lookup the display value */
  keys: string[];
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  metadata?: any;
};
export type GetDisplayMappingApiArg = {
  /** Display keys */
  key: string[];
};
