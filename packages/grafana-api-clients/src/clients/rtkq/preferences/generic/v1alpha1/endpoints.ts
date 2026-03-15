import { PreferencesSpec } from '../../v1alpha1/endpoints.gen';

import { api } from './baseAPI';

const addTagTypes = ['Preferences'] as const;

const injectedApi = api.enhanceEndpoints({ addTagTypes }).injectEndpoints({
  endpoints: (build) => ({
    getPreferences: build.query<PreferencesSpec, { resourceUri: string }>({
      query: ({ resourceUri }) => ({ url: `/${resourceUri}/preferences` }),
      providesTags: ['Preferences'],
    }),
    updatePreferences: build.mutation<void, { resourceUri: string; preferences: PreferencesSpec }>({
      query: ({ resourceUri, preferences }) => ({
        url: `/${resourceUri}/preferences`,
        method: 'PUT',
        body: preferences,
      }),
      invalidatesTags: ['Preferences'],
    }),
  }),
  overrideExisting: false,
});

export const { useGetPreferencesQuery, useUpdatePreferencesMutation } = injectedApi;
export { injectedApi as generatedAPI };
