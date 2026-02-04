import { api } from './baseAPI';
const injectedRtkApi = api.injectEndpoints({
  endpoints: (build) => ({
    unstarDashboardByUid: build.mutation<UnstarDashboardByUidApiResponse, UnstarDashboardByUidApiArg>({
      query: (queryArg) => ({ url: `/user/stars/dashboard/uid/${queryArg.dashboardUid}`, method: 'DELETE' }),
    }),
    starDashboardByUid: build.mutation<StarDashboardByUidApiResponse, StarDashboardByUidApiArg>({
      query: (queryArg) => ({ url: `/user/stars/dashboard/uid/${queryArg.dashboardUid}`, method: 'POST' }),
    }),
  }),
  overrideExisting: false,
});
export { injectedRtkApi as generatedAPI };
export type UnstarDashboardByUidApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type UnstarDashboardByUidApiArg = {
  dashboardUid: string;
};
export type StarDashboardByUidApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type StarDashboardByUidApiArg = {
  dashboardUid: string;
};
export type SuccessResponseBody = {
  message?: string;
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
export const { useUnstarDashboardByUidMutation, useStarDashboardByUidMutation } = injectedRtkApi;
