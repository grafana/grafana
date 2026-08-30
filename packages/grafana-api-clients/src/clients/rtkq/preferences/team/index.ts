import { generatedAPI as rawAPI } from './endpoints.gen';

export const generatedAPI = rawAPI.enhanceEndpoints({
  addTagTypes: ['TeamPreferences'],
  endpoints: {
    getTeamPreferences: {
      providesTags: ['TeamPreferences'],
    },
    updateTeamPreferences: {
      invalidatesTags: ['TeamPreferences'],
    },
  },
});

export * from './endpoints.gen';
