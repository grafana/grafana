export { BASE_URL, API_GROUP, API_VERSION } from './baseAPI';
import { generatedAPI as rawAPI } from './endpoints.gen';

export * from './endpoints.gen';
export const generatedAPI = rawAPI.enhanceEndpoints({
  endpoints: {
    createCorrelation: (endpointDefinition) => {
      const originalQuery = endpointDefinition.query;
      if (!originalQuery) {
        return;
      }
      endpointDefinition.query = (requestOptions) => {
        // Ensure metadata exists
        if (!requestOptions.correlation.metadata) {
          requestOptions.correlation.metadata = {};
        }
        const metadata = requestOptions.correlation.metadata;
        if (!metadata.name && !metadata.generateName) {
          // GenerateName lets the apiserver create a new uid for the name
          metadata.generateName = 'c';
        }
        return originalQuery(requestOptions);
      };
    },
    // todo - do i add data massaging to list correlations here??
  },
});
