import { api } from './baseAPI';
export const addTagTypes = [] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      getUsage: build.query<GetUsageApiResponse, GetUsageApiArg>({
        query: (queryArg) => ({
          url: `/usage`,
          params: {
            group: queryArg.group,
            resource: queryArg.resource,
          },
        }),
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as generatedAPI };
export type GetUsageApiResponse = /** status 200 OK */ GetUsageResponse;
export type GetUsageApiArg = {
  group?: string;
  resource?: string;
};
export type GetUsageResponse = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion: string;
  group: string;
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind: string;
  limit: number;
  namespace: string;
  resource: string;
  usage: number;
};
export const { useGetUsageQuery, useLazyGetUsageQuery } = injectedRtkApi;
