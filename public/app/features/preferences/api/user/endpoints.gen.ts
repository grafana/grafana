import { baseAPI as api } from './baseAPI';
const injectedRtkApi = api.injectEndpoints({
  endpoints: (build) => ({
    getUserPreferences: build.query<GetUserPreferencesApiResponse, GetUserPreferencesApiArg>({
      query: () => ({ url: `/user/preferences` }),
    }),
    patchUserPreferences: build.mutation<PatchUserPreferencesApiResponse, PatchUserPreferencesApiArg>({
      query: (queryArg) => ({ url: `/user/preferences`, method: 'PATCH', body: queryArg.body }),
    }),
    updateUserPreferences: build.mutation<UpdateUserPreferencesApiResponse, UpdateUserPreferencesApiArg>({
      query: (queryArg) => ({ url: `/user/preferences`, method: 'PUT', body: queryArg.body }),
    }),
  }),
  overrideExisting: false,
});
export { injectedRtkApi as generatedAPI };
export type GetUserPreferencesApiResponse = unknown;
export type GetUserPreferencesApiArg = void;
export type PatchUserPreferencesApiResponse = unknown;
export type PatchUserPreferencesApiArg = {
  body: any;
};
export type UpdateUserPreferencesApiResponse = unknown;
export type UpdateUserPreferencesApiArg = {
  body: any;
};
export const { useGetUserPreferencesQuery, usePatchUserPreferencesMutation, useUpdateUserPreferencesMutation } =
  injectedRtkApi;
