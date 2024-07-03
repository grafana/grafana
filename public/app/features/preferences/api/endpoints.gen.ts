import { baseAPI as api } from './baseAPI';
const injectedRtkApi = api.injectEndpoints({
  endpoints: (build) => ({
    getOrgPreferences: build.query<GetOrgPreferencesApiResponse, GetOrgPreferencesApiArg>({
      query: () => ({ url: `/org/preferences` }),
    }),
    patchOrgPreferences: build.mutation<PatchOrgPreferencesApiResponse, PatchOrgPreferencesApiArg>({
      query: (queryArg) => ({ url: `/org/preferences`, method: 'PATCH', body: queryArg.preferencesDto }),
    }),
    updateOrgPreferences: build.mutation<UpdateOrgPreferencesApiResponse, UpdateOrgPreferencesApiArg>({
      query: (queryArg) => ({ url: `/org/preferences`, method: 'PUT', body: queryArg.preferencesDto }),
    }),
    getUserPreferences: build.query<GetUserPreferencesApiResponse, GetUserPreferencesApiArg>({
      query: () => ({ url: `/user/preferences` }),
    }),
    patchUserPreferences: build.mutation<PatchUserPreferencesApiResponse, PatchUserPreferencesApiArg>({
      query: (queryArg) => ({ url: `/user/preferences`, method: 'PATCH', body: queryArg.preferencesDto }),
    }),
    updateUserPreferences: build.mutation<UpdateUserPreferencesApiResponse, UpdateUserPreferencesApiArg>({
      query: (queryArg) => ({ url: `/user/preferences`, method: 'PUT', body: queryArg.preferencesDto }),
    }),
  }),
  overrideExisting: false,
});
export { injectedRtkApi as generatedAPI };
export type GetOrgPreferencesApiResponse = /** status 200 (empty) */ Preferences;
export type GetOrgPreferencesApiArg = void;
export type PatchOrgPreferencesApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type PatchOrgPreferencesApiArg = {
  preferencesDto: PatchPreferencesDto;
};
export type UpdateOrgPreferencesApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type UpdateOrgPreferencesApiArg = {
  preferencesDto: UpdatePreferencesDto;
};
export type GetUserPreferencesApiResponse = /** status 200 (empty) */ Preferences;
export type GetUserPreferencesApiArg = void;
export type PatchUserPreferencesApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type PatchUserPreferencesApiArg = {
  preferencesDto: PatchPreferencesDto;
};
export type UpdateUserPreferencesApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type UpdateUserPreferencesApiArg = {
  preferencesDto: UpdatePreferencesDto;
};
export type CookiePreferencesDefinesModelForCookiePreferences = {
  analytics?: {
    [key: string]: any;
  };
  functional?: {
    [key: string]: any;
  };
  performance?: {
    [key: string]: any;
  };
};
export type NavbarPreferenceDefinesModelForNavbarPreference = {
  savedItemIds?: string[];
};
export type QueryHistoryPreferenceDefinesModelForQueryHistoryPreference = {
  /** HomeTab one of: '' | 'query' | 'starred'; */
  homeTab?: string;
};
export type Preferences = {
  cookiePreferences?: CookiePreferencesDefinesModelForCookiePreferences;
  /** UID for the home dashboard */
  homeDashboardUID?: string;
  /** Selected language (beta) */
  language?: string;
  navbar?: NavbarPreferenceDefinesModelForNavbarPreference;
  queryHistory?: QueryHistoryPreferenceDefinesModelForQueryHistoryPreference;
  /** Theme light, dark, empty is default */
  theme?: string;
  /** The timezone selection
    TODO: this should use the timezone defined in common */
  timezone?: string;
  /** WeekStart day of the week (sunday, monday, etc) */
  weekStart?: string;
};
export type ErrorResponseBody = {
  /** Error An optional detailed description of the actual error. Only included if running in developer mode. */
  error?: string;
  /** a human-readable version of the error */
  message: string;
  /** Status An optional status to denote the cause of the error.

    For example, a 412 Precondition Failed error may include additional information of why that error happened. */
  status?: string;
};
export type SuccessResponseBody = {
  message?: string;
};
export type CookieType = string;
export type PatchPreferencesDto = {
  cookies?: CookieType[];
  /** The numerical :id of a favorited dashboard */
  homeDashboardId?: number;
  homeDashboardUID?: string;
  language?: string;
  navbar?: NavbarPreferenceDefinesModelForNavbarPreference;
  queryHistory?: QueryHistoryPreferenceDefinesModelForQueryHistoryPreference;
  theme?: 'light' | 'dark';
  timezone?: 'utc' | 'browser';
  weekStart?: string;
};
export type UpdatePreferencesDto = {
  cookies?: CookieType[];
  /** The numerical :id of a favorited dashboard */
  homeDashboardId?: number;
  homeDashboardUID?: string;
  language?: string;
  navbar?: NavbarPreferenceDefinesModelForNavbarPreference;
  queryHistory?: QueryHistoryPreferenceDefinesModelForQueryHistoryPreference;
  theme?: 'light' | 'dark' | 'system';
  timezone?: 'utc' | 'browser';
  weekStart?: string;
};
export const {
  useGetOrgPreferencesQuery,
  usePatchOrgPreferencesMutation,
  useUpdateOrgPreferencesMutation,
  useGetUserPreferencesQuery,
  usePatchUserPreferencesMutation,
  useUpdateUserPreferencesMutation,
} = injectedRtkApi;
