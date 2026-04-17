import { api } from './baseAPI';
const injectedRtkApi = api.injectEndpoints({
  endpoints: (build) => ({
    getOrgPreferences: build.query<GetOrgPreferencesApiResponse, GetOrgPreferencesApiArg>({
      query: () => ({ url: `/org/preferences` }),
    }),
    patchOrgPreferences: build.mutation<PatchOrgPreferencesApiResponse, PatchOrgPreferencesApiArg>({
      query: (queryArg) => ({ url: `/org/preferences`, method: 'PATCH', body: queryArg.patchPrefsCmd }),
    }),
    updateOrgPreferences: build.mutation<UpdateOrgPreferencesApiResponse, UpdateOrgPreferencesApiArg>({
      query: (queryArg) => ({ url: `/org/preferences`, method: 'PUT', body: queryArg.updatePrefsCmd }),
    }),
  }),
  overrideExisting: false,
});
export { injectedRtkApi as generatedAPI };
export type GetOrgPreferencesApiResponse = /** status 200 (empty) */ PreferencesSpec;
export type GetOrgPreferencesApiArg = void;
export type PatchOrgPreferencesApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type PatchOrgPreferencesApiArg = {
  patchPrefsCmd: PatchPrefsCmd;
};
export type UpdateOrgPreferencesApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type UpdateOrgPreferencesApiArg = {
  updatePrefsCmd: UpdatePrefsCmd;
};
export type PreferencesNavbarPreference = {
  bookmarkUrls?: string[];
};
export type PreferencesQueryHistoryPreference = {
  /** one of: '' | 'query' | 'starred'; */
  homeTab?: string;
};
export type PreferencesSpec = {
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
export type NavbarPreference = {
  bookmarkUrls?: string[];
};
export type QueryHistoryPreference = {
  homeTab?: string;
};
export type PatchPrefsCmd = {
  /** The numerical :id of a favorited dashboard */
  homeDashboardId?: number;
  homeDashboardUID?: string;
  language?: string;
  navbar?: NavbarPreference;
  queryHistory?: QueryHistoryPreference;
  regionalFormat?: string;
  theme?: 'light' | 'dark';
  /** Any IANA timezone string (e.g. America/New_York), 'utc', 'browser', or empty string */
  timezone?: string;
  weekStart?: string;
};
export type UpdatePrefsCmd = {
  /** The numerical :id of a favorited dashboard */
  homeDashboardId?: number;
  homeDashboardUID?: string;
  language?: string;
  navbar?: NavbarPreference;
  queryHistory?: QueryHistoryPreference;
  regionalFormat?: string;
  theme?: 'light' | 'dark' | 'system';
  /** Any IANA timezone string (e.g. America/New_York), 'utc', 'browser', or empty string */
  timezone?: string;
  weekStart?: string;
};
export const {
  useGetOrgPreferencesQuery,
  useLazyGetOrgPreferencesQuery,
  usePatchOrgPreferencesMutation,
  useUpdateOrgPreferencesMutation,
} = injectedRtkApi;
