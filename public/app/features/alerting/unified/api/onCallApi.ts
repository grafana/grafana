import { FetchError, isFetchError } from '@grafana/runtime';

import { GRAFANA_ONCALL_INTEGRATION_TYPE } from '../components/receivers/grafanaAppReceivers/onCall/onCall';
import { getIrmIfPresentOrOnCallPluginId } from '../utils/config';

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

export const ONCALL_INTEGRATION_V2_FEATURE = 'grafana_alerting_v2';
type OnCallFeature = typeof ONCALL_INTEGRATION_V2_FEATURE | string;

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

export interface OnCallConfigChecks {
  is_chatops_connected: boolean;
  is_integration_chatops_connected: boolean;
}

export function getProxyApiUrl(path: string) {
  return `/api/plugins/${getIrmIfPresentOrOnCallPluginId()}/resources${path}`;
}

export const onCallApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    grafanaOnCallIntegrations: build.query<OnCallIntegrationDTO[], void>({
      query: () => ({
        url: getProxyApiUrl('/alert_receive_channels/'),
        // legacy_grafana_alerting is necessary for OnCall.
        // We do NOT need to differentiate between these two on our side
        params: {
          filters: true,
          integration: [GRAFANA_ONCALL_INTEGRATION_TYPE, 'legacy_grafana_alerting'],
          skip_pagination: true,
        },
        showErrorAlert: false,
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
        url: getProxyApiUrl('/alert_receive_channels/validate_name/'),
        params: { verbal_name: name },
        showErrorAlert: false,
      }),
    }),
    createIntegration: build.mutation<NewOnCallIntegrationDTO, CreateIntegrationDTO>({
      query: (integration) => ({
        url: getProxyApiUrl('/alert_receive_channels/'),
        data: integration,
        method: 'POST',
        showErrorAlert: true,
      }),
      invalidatesTags: ['OnCallIntegrations'],
    }),
    features: build.query<OnCallFeature[], void>({
      query: () => ({
        url: getProxyApiUrl('/features/'),
        showErrorAlert: false,
      }),
    }),
    onCallConfigChecks: build.query<OnCallConfigChecks, void>({
      query: () => ({
        url: getProxyApiUrl('/organization/config-checks/'),
        showErrorAlert: false,
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

export function isOnCallFetchError(error: unknown): error is FetchError<{ detail: string }> {
  return isFetchError(error) && 'detail' in error.data;
}
