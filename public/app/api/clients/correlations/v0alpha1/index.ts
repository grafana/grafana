import { generatedAPI } from './endpoints.gen';

export const correlationAPIv0alpha1 = generatedAPI.enhanceEndpoints({
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
  },
});
