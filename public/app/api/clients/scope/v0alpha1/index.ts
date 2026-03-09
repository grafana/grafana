import { generatedAPI } from './endpoints.gen';

// Extend the generated navigation endpoints with depth and rootScope params.
// These params are used by Google's backend but aren't in the local OpenAPI spec,
// so we add them here rather than editing the generated file directly.
// This override is safe to keep even if the generated file is regenerated —
// the function form merges extra params into whatever the generated query produces.

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const getExtra = (queryArg: unknown) => queryArg as Record<string, unknown>;

export const scopeAPIv0alpha1 = generatedAPI.enhanceEndpoints({
  endpoints: {
    getFindScopeDashboardBindingsResults: (endpoint) => {
      const originalQuery = endpoint.query!;
      endpoint.query = (queryArg) => {
        const base = originalQuery(queryArg);
        return { ...base, params: { ...base.params, depth: getExtra(queryArg).depth } };
      };
    },
    getFindScopeNavigationsResults: (endpoint) => {
      const originalQuery = endpoint.query!;
      endpoint.query = (queryArg) => {
        const base = originalQuery(queryArg);
        return { ...base, params: { ...base.params, depth: getExtra(queryArg).depth } };
      };
    },
  },
});
