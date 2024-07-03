export * from './endpoints.gen';

import { generatedAPI } from './endpoints.gen';

export const cloudMigrationAPI = generatedAPI.enhanceEndpoints({
  addTagTypes: ['UserPreferences', 'OrgPreferences'],
  endpoints: {
    getUserPreferences: {
      providesTags: ['UserPreferences'],
    },
    updateUserPreferences: {
      invalidatesTags: ['UserPreferences'],
    },
    patchUserPreferences: {
      invalidatesTags: ['UserPreferences'],
    },
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
