import { generatedAPI, addTagTypes } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';

export const dashboardAPIv0alpha1 = generatedAPI.enhanceEndpoints({
  addTagTypes: [...addTagTypes, 'Folder', 'Dashboard'],
  endpoints: {
    getSearch: (endpointDefinition) => {
      endpointDefinition.providesTags = ['Search', 'Folder', 'Dashboard'];
    },
  },
});

export const { useGetSearchQuery } = dashboardAPIv0alpha1;
