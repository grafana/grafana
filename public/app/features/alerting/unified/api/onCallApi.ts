import { alertingApi } from './alertingApi';
export interface OnCallIntegration {
  [key: string]: string;
  integration_url: string;
}
export type OnCallIntegrationsResponse = OnCallIntegration[];
export type OnCallIntegrationsUrls = string[];

export const onCallApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    getOnCallIntegrations: build.query<OnCallIntegrationsUrls, void>({
      query: () => ({
        headers: {},
        url: '/api/plugin-proxy/grafana-oncall-app/api/internal/v1/alert_receive_channels/?search=',
      }),
      providesTags: ['AlertmanagerChoice'],
      transformResponse: (response: OnCallIntegrationsResponse) => response.map((result) => result.integration_url),
    }),
  }),
});

export const useGetOnCallIntegrations = (skip: boolean) => {
  const { data } = onCallApi.useGetOnCallIntegrationsQuery(undefined, {
    skip,
  });
  return data;
};
