import { alertingApi } from './alertingApi';

export interface OnCallIntegration {
  id: number;
  connected_escalations_chains_count: number;
  integration: string;
  integration_url: string;
  verbal_name: string;
}

export interface CreateIntegrationDTO {
  integration: 'grafana'; // The only one supported right now
  verbal_name: string;
}

export const onCallApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    getOnCallIntegrations: build.query<OnCallIntegration[], void>({
      query: () => ({ url: '/api/plugin-proxy/grafana-oncall-app/api/internal/v1/alert_receive_channels/' }),
      providesTags: ['OnCallIntegrations'],
    }),
    createIntegration: build.mutation<OnCallIntegration, CreateIntegrationDTO>({
      query: (integration) => ({
        url: '/api/plugin-proxy/grafana-oncall-app/api/internal/v1/alert_receive_channels/',
        data: integration,
        method: 'POST',
      }),
      invalidatesTags: ['OnCallIntegrations'],
    }),
  }),
});

export const { useGetOnCallIntegrationsQuery } = onCallApi;
