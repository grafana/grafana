import { api } from './baseAPI';
const injectedRtkApi = api.injectEndpoints({
  endpoints: (build) => ({
    getTeamPreferences: build.query<GetTeamPreferencesApiResponse, GetTeamPreferencesApiArg>({
      query: (queryArg) => ({ url: `/teams/${queryArg.teamId}/preferences` }),
    }),
    updateTeamPreferences: build.mutation<UpdateTeamPreferencesApiResponse, UpdateTeamPreferencesApiArg>({
      query: (queryArg) => ({
        url: `/teams/${queryArg.teamId}/preferences`,
        method: 'PUT',
        body: queryArg.updatePrefsCmd,
      }),
    }),
  }),
  overrideExisting: false,
});
export { injectedRtkApi as generatedAPI };
export type GetTeamPreferencesApiResponse = /** status 200 (empty) */ PreferencesSpec;
export type GetTeamPreferencesApiArg = {
  teamId: string;
};
export type UpdateTeamPreferencesApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type UpdateTeamPreferencesApiArg = {
  teamId: string;
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
export const { useGetTeamPreferencesQuery, useLazyGetTeamPreferencesQuery, useUpdateTeamPreferencesMutation } =
  injectedRtkApi;
