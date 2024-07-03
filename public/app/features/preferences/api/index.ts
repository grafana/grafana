import { generatedAPI } from './user/endpoints.gen';

export const { useGetUserPreferencesQuery, usePatchUserPreferencesMutation, useUpdateUserPreferencesMutation } =
  generatedAPI;

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
