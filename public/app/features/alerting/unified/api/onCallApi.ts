import { lastValueFrom } from 'rxjs';

import { getBackendSrv } from '@grafana/runtime';

import { alertingApi } from './alertingApi';
export interface OnCallIntegration {
  integration_url: string;
}
export type OnCallIntegrationsResponse = OnCallIntegration[];
export type OnCallIntegrationsUrls = string[];

export const onCallApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    getOnCallIntegrations: build.query<OnCallIntegrationsUrls, void>({
      queryFn: async () => {
        const integrations = await fetchOnCallIntegrations();
        return { data: integrations };
      },
    }),
  }),
});
export async function fetchOnCallIntegrations(): Promise<OnCallIntegrationsUrls> {
  try {
    const response = await lastValueFrom(
      getBackendSrv().fetch<OnCallIntegrationsResponse>({
        url: '/api/plugin-proxy/grafana-oncall-app/api/internal/v1/alert_receive_channels/',
        showErrorAlert: false,
        showSuccessAlert: false,
      })
    );
    return response.data.map((result) => result.integration_url);
  } catch (error) {
    return [];
  }
}
export const { useGetOnCallIntegrationsQuery } = onCallApi;
