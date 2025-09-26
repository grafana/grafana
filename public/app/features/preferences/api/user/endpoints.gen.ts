import { baseAPI as api } from './baseAPI';
const injectedRtkApi = api.injectEndpoints({
  endpoints: (build) => ({
    getUserPreferences: build.query<GetUserPreferencesApiResponse, GetUserPreferencesApiArg>({
      query: () => ({ url: `/user/preferences` }),
    }),
    patchUserPreferences: build.mutation<PatchUserPreferencesApiResponse, PatchUserPreferencesApiArg>({
      query: (queryArg) => ({ url: `/user/preferences`, method: 'PATCH', body: queryArg.patchPrefsCmd }),
    }),
    updateUserPreferences: build.mutation<UpdateUserPreferencesApiResponse, UpdateUserPreferencesApiArg>({
      query: (queryArg) => ({ url: `/user/preferences`, method: 'PUT', body: queryArg.updatePrefsCmd }),
    }),
  }),
  overrideExisting: false,
});
export { injectedRtkApi as generatedAPI };
export type GetUserPreferencesApiResponse = /** status 200 (empty) */ PreferencesSpec;
export type GetUserPreferencesApiArg = void;
export type PatchUserPreferencesApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type PatchUserPreferencesApiArg = {
  patchPrefsCmd: PatchPrefsCmd;
};
export type UpdateUserPreferencesApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type UpdateUserPreferencesApiArg = {
  updatePrefsCmd: UpdatePrefsCmd;
};
export type PreferencesCookiePreferences = {
  analytics?: any;
  functional?: any;
  performance?: any;
};
export type PreferencesNavbarPreference = {
  bookmarkUrls?: string[];
};
export type PreferencesQueryHistoryPreference = {
  /** one of: '' | 'query' | 'starred'; */
  homeTab?: string;
};
export type PreferencesSpec = {
  cookiePreferences?: PreferencesCookiePreferences;
  /** UID for the home dashboard */
  homeDashboardUID?: string;
  /** Selected language (beta) */
  language?: string;
  navbar?: PreferencesNavbarPreference;
  queryHistory?: PreferencesQueryHistoryPreference;
  /** Selected locale (beta) */
  regionalFormat?: string;
  /** light, dark, empty is default */
  theme?: string;
  /** The timezone selection
    TODO: this should use the timezone defined in common */
  timezone?: string;
  /** day of the week (sunday, monday, etc) */
  weekStart?: string;
};
export type ErrorResponseBody = {
  /** Error An optional detailed description of the actual error. Only included if running in developer mode. */
  error?: string;
  /** a human readable version of the error */
  message: string;
  /** Status An optional status to denote the cause of the error.
    
    For example, a 412 Precondition Failed error may include additional information of why that error happened. */
  status?: string;
};
export type SuccessResponseBody = {
  message?: string;
};
export type CookieType = string;
export type NavbarPreference = {
  bookmarkUrls?: string[];
};
export type QueryHistoryPreference = {
  homeTab?: string;
};
export type PatchPrefsCmd = {
  cookies?: CookieType[];
  /** The numerical :id of a favorited dashboard */
  homeDashboardId?: number;
  homeDashboardUID?: string;
  language?: string;
  navbar?: NavbarPreference;
  queryHistory?: QueryHistoryPreference;
  regionalFormat?: string;
  theme?: 'light' | 'dark';
  timezone?: 'utc' | 'browser';
  weekStart?: string;
};
export type UpdatePrefsCmd = {
  cookies?: CookieType[];
  /** The numerical :id of a favorited dashboard */
  homeDashboardId?: number;
  homeDashboardUID?: string;
  language?: string;
  navbar?: NavbarPreference;
  queryHistory?: QueryHistoryPreference;
  regionalFormat?: string;
  theme?: 'light' | 'dark' | 'system';
  timezone?: 'utc' | 'browser';
  weekStart?: string;
};
export const { useGetUserPreferencesQuery, usePatchUserPreferencesMutation, useUpdateUserPreferencesMutation } =
  injectedRtkApi;
