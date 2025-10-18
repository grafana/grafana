import { generatedAPI } from './endpoints.gen';

export const dashboardAPIv0alpha1 = generatedAPI.enhanceEndpoints({
  addTagTypes: ['Folder', 'Dashboard'],
  endpoints: {
    getSearch: (endpointDefinition) => {
      endpointDefinition.providesTags = ['Search', 'Folder', 'Dashboard'];
    },
  },
});

export const { useGetSearchQuery } = dashboardAPIv0alpha1;
