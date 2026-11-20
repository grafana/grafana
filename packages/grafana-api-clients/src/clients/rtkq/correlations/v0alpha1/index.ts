export { BASE_URL, API_GROUP, API_VERSION } from './baseAPI';
import { generatedAPI as rawAPI } from './endpoints.gen';

export * from './endpoints.gen';
export const generatedAPI = rawAPI.enhanceEndpoints({
  endpoints: {
    updateCorrelation: (endpointDefinition) => {
      const originalQuery = endpointDefinition.query;
      if (!originalQuery) {
        return;
      }
      endpointDefinition.query = (requestOptions) => ({
        ...originalQuery(requestOptions),
        headers: {
          'Content-Type': 'application/merge-patch+json',
        },
      });
    },
  },
});
