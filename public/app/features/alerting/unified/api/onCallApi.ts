import { GRAFANA_ONCALL_INTEGRATION_TYPE } from '../components/receivers/grafanaAppReceivers/onCall/onCall';

import { alertingApi } from './alertingApi';

export interface NewOnCallIntegrationDTO {
  id: string;
  connected_escalations_chains_count: number;
  integration: string;
  integration_url: string;
  verbal_name: string;
}

export interface OnCallIntegrationDTO {
  value: string;
  display_name: string;
  integration_url: string;
}

export interface CreateIntegrationDTO {
  integration: typeof GRAFANA_ONCALL_INTEGRATION_TYPE; // The only one supported right now
  verbal_name: string;
}

export const onCallApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    grafanaOnCallIntegrations: build.query<OnCallIntegrationDTO[], void>({
      query: () => ({
        url: '/api/plugin-proxy/grafana-oncall-app/api/internal/v1/alert_receive_channels/',
        params: { filters: true, integration: GRAFANA_ONCALL_INTEGRATION_TYPE },
      }),
      providesTags: ['OnCallIntegrations'],
    }),
    validateIntegrationName: build.query<boolean, string>({
      query: (name) => ({
        url: `/api/plugin-proxy/grafana-oncall-app/api/internal/v1/alert_receive_channels/validate_name/`,
        params: { verbal_name: name },
      }),
    }),
    createIntegration: build.mutation<NewOnCallIntegrationDTO, CreateIntegrationDTO>({
      query: (integration) => ({
        url: '/api/plugin-proxy/grafana-oncall-app/api/internal/v1/alert_receive_channels/',
        data: integration,
        method: 'POST',
      }),
      invalidatesTags: ['OnCallIntegrations'],
    }),
  }),
});

export const { useGrafanaOnCallIntegrationsQuery } = onCallApi;
