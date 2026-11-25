export { BASE_URL, API_GROUP, API_VERSION } from './baseAPI';
import { addTagTypes, generatedAPI as rawAPI } from './endpoints.gen';

export * from './endpoints.gen';
export const generatedAPI = rawAPI.enhanceEndpoints({
  addTagTypes: [...addTagTypes, 'Folder', 'Dashboard'],
  endpoints: {
    // An object patch would default to strategic merge, which this API group answers with a 500. A JSON
    // Patch operation list still gets its own content type from createBaseQuery.
    updateDashboardPreferences: (endpointDefinition) => {
      const originalQuery = endpointDefinition.query;
      if (!originalQuery) {
        return;
      }
      endpointDefinition.query = (queryArg) => {
        const request = originalQuery(queryArg);
        return {
          ...request,
          headers: { ...request.headers, 'Content-Type': 'application/merge-patch+json' },
        };
      };
    },
  },
});
