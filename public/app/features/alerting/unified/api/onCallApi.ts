import { GRAFANA_ONCALL_INTEGRATION_TYPE } from '../components/receivers/grafanaAppReceivers/onCall/onCall';
import { SupportedPlugin } from '../types/pluginBridges';

import { alertingApi } from './alertingApi';

export interface NewOnCallIntegrationDTO {
  id: string;
  connected_escalations_chains_count: number;
  integration: string;
  integration_url: string;
  verbal_name: string;
}

export interface OnCallPaginatedResult<T> {
  results: T[];
}

type AlertReceiveChannelsResult = OnCallPaginatedResult<OnCallIntegrationDTO> | OnCallIntegrationDTO[];

export interface OnCallIntegrationDTO {
  value: string;
  display_name: string;
  integration_url: string;
}

export interface CreateIntegrationDTO {
  integration: typeof GRAFANA_ONCALL_INTEGRATION_TYPE; // The only one supported right now
  verbal_name: string;
}

const getProxyApiUrl = (path: string) => `/api/plugin-proxy/${SupportedPlugin.OnCall}${path}`;

export const onCallApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    grafanaOnCallIntegrations: build.query<OnCallIntegrationDTO[], void>({
      query: () => ({
        url: getProxyApiUrl('/api/internal/v1/alert_receive_channels/'),
        // legacy_grafana_alerting is necessary for OnCall. We no need to differentiate between these two on our side
        params: { filters: true, integration: [GRAFANA_ONCALL_INTEGRATION_TYPE, 'legacy_grafana_alerting'] },
      }),
      transformResponse: (response: AlertReceiveChannelsResult) => {
        if (isPaginatedResponse(response)) {
          return response.results;
        }
        return response;
      },
      providesTags: ['OnCallIntegrations'],
    }),
    validateIntegrationName: build.query<boolean, string>({
      query: (name) => ({
        url: getProxyApiUrl('/api/internal/v1/alert_receive_channels/validate_name/'),
        params: { verbal_name: name },
        showErrorAlert: false,
      }),
    }),
    createIntegration: build.mutation<NewOnCallIntegrationDTO, CreateIntegrationDTO>({
      query: (integration) => ({
        url: getProxyApiUrl('/api/internal/v1/alert_receive_channels/'),
        data: integration,
        method: 'POST',
        showErrorAlert: true,
      }),
      invalidatesTags: ['OnCallIntegrations'],
    }),
    features: build.query<string[], void>({
      query: () => ({
        url: getProxyApiUrl('/api/internal/v1/features/'),
      }),
    }),
  }),
});

function isPaginatedResponse(
  response: AlertReceiveChannelsResult
): response is OnCallPaginatedResult<OnCallIntegrationDTO> {
  return 'results' in response && Array.isArray(response.results);
}

export const { useGrafanaOnCallIntegrationsQuery } = onCallApi;
