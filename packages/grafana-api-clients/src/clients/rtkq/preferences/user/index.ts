import { generatedAPI as rawAPI } from './endpoints.gen';

export const generatedAPI = rawAPI.enhanceEndpoints({
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

export * from './endpoints.gen';
