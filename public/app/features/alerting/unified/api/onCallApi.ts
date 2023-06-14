import { alertingApi } from './alertingApi';

export interface OnCallIntegration {
  id: number;
  connected_escalations_chains_count: number;
  integration: string;
  integration_url: string;
  verbal_name: string;
}

export const onCallApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    getOnCallIntegrations: build.query<OnCallIntegration[], void>({
      query: () => ({ url: '/api/plugin-proxy/grafana-oncall-app/api/internal/v1/alert_receive_channels/' }),
    }),
  }),
});

export const { useGetOnCallIntegrationsQuery } = onCallApi;
