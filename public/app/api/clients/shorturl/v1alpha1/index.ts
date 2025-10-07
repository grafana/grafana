import { generatedAPI } from './endpoints.gen';

export const shortURLAPIv1alpha1 = generatedAPI.enhanceEndpoints({
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
          // This wont be used, the backend will generate a random uid but cannot be blank or will fail.
          metadata.generateName = 's-';
        }
        return originalQuery(requestOptions);
      };
    },
  },
});
