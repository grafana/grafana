import { generatedAPI } from './endpoints.gen';

export const advisorAPIv0alpha1 = generatedAPI.enhanceEndpoints({
  endpoints: {
    // Need to mutate the generated query to set the Content-Type header correctly
    updateCheck: (endpointDefinition) => {
      const originalQuery = endpointDefinition.query;
      if (originalQuery) {
        endpointDefinition.query = (requestOptions) => ({
          ...originalQuery(requestOptions),
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
          body: JSON.stringify(requestOptions.patch),
        });
      }
    },
    updateCheckType: (endpointDefinition) => {
      const originalQuery = endpointDefinition.query;
      if (originalQuery) {
        endpointDefinition.query = (requestOptions) => ({
          ...originalQuery(requestOptions),
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
          body: JSON.stringify(requestOptions.patch),
        });
      }
    },
  },
});
export const {
  useGetCheckQuery,
  useListCheckQuery,
  useCreateCheckMutation,
  useDeleteCheckMutation,
  useUpdateCheckMutation,
  useListCheckTypeQuery,
  useUpdateCheckTypeMutation,
} = advisorAPIv0alpha1;
export { type Check, type CheckType } from './endpoints.gen'; // eslint-disable-line
