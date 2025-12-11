import { generatedAPI } from '@grafana/api-clients/rtkq/shorturl/v1beta1';

export const shortURLAPIv1beta1 = generatedAPI.enhanceEndpoints({
  endpoints: {
    createShortUrl: (endpointDefinition) => {
      const originalQuery = endpointDefinition.query;
      if (!originalQuery) {
        return;
      }

      endpointDefinition.query = (requestOptions) => {
        // Ensure metadata exists
        if (!requestOptions.shortUrl.metadata) {
          requestOptions.shortUrl.metadata = {};
        }

        const metadata = requestOptions.shortUrl.metadata;
        if (!metadata.name && !metadata.generateName) {
          // GenerateName lets the apiserver create a new uid for the name
          metadata.generateName = 's'; // becomes a prefix
        }
        return originalQuery(requestOptions);
      };
    },
  },
});
