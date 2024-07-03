export * from './user/endpoints.gen';

import { generatedAPI } from './user/endpoints.gen';

export const userPreferencesAPI = generatedAPI.enhanceEndpoints({
  addTagTypes: ['UserPreferences'],
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
  },
});
