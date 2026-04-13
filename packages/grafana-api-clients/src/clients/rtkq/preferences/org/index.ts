import { generatedAPI as rawAPI } from './endpoints.gen';

export const generatedAPI = rawAPI.enhanceEndpoints({
  addTagTypes: ['OrgPreferences'],
  endpoints: {
    getOrgPreferences: {
      providesTags: ['OrgPreferences'],
    },
    updateOrgPreferences: {
      invalidatesTags: ['OrgPreferences'],
    },
    patchOrgPreferences: {
      invalidatesTags: ['OrgPreferences'],
    },
  },
});

export * from './endpoints.gen';
