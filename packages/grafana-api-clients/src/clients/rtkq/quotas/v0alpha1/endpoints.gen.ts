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
export type GetUsageApiResponse = unknown;
export type GetUsageApiArg = {
  group?: string;
  resource?: string;
};
export const { useGetUsageQuery, useLazyGetUsageQuery } = injectedRtkApi;
