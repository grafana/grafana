import { FetchError, isFetchError } from '@grafana/runtime';

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

export const ONCALL_INTEGRATION_V2_FEATURE = 'grafana_alerting_v2';
export const ONCALL_ADAPTIVE_ALERTING_FEATURE = 'grafana_adaptive_alerting';
type OnCallFeature = typeof ONCALL_INTEGRATION_V2_FEATURE | typeof ONCALL_ADAPTIVE_ALERTING_FEATURE | string;

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

type EscalationChainResult = OnCallPaginatedResult<OnCallEscalationChainDTO> | OnCallEscalationChainDTO[];

export interface OnCallEscalationChainDTO {
  id: string;
  name: string;
  team?: string;
}

type TeamResult = OnCallPaginatedResult<OnCallTeamDTO> | OnCallTeamDTO[];

export interface OnCallTeamDTO {
  id: string;
  name: string;
  email?: string;
  avatar_url?: string;
  is_sharing_resources_to_all: boolean;
}

type SlackChannelResult = OnCallPaginatedResult<OnCallSlackChannelDTO> | OnCallSlackChannelDTO[];

export interface OnCallSlackChannelDTO {
  id: string;
  display_name: string;
  slack_id: string;
}

const getProxyApiUrl = (path: string) => `/api/plugins/${SupportedPlugin.OnCall}/resources${path}`;

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
    grafanaOnCallEscalationChains: build.query<OnCallEscalationChainDTO[], void>({
      query: () => ({
        url: getProxyApiUrl('/escalation_chains/'),
        params: {
          skip_pagination: true,
        },
        showErrorAlert: false,
      }),
      transformResponse: (response: EscalationChainResult) => {
        if (isPaginatedResponse(response)) {
          return response.results;
        }
        return response;
      },
      providesTags: ['OnCallEscalationChains'],
    }),
    grafanaOnCallTeams: build.query<OnCallTeamDTO[], void>({
      query: () => ({
        url: getProxyApiUrl('/teams/'),
        params: {
          include_no_team: false,
          only_include_notifiable_teams: false,
          short: true,
          skip_pagination: true,
        },
        showErrorAlert: false,
      }),
      transformResponse: (response: TeamResult) => {
        if (isPaginatedResponse(response)) {
          return response.results;
        }
        return response;
      },
      providesTags: ['OnCallTeams'],
    }),
    grafanaOnCallSlackChannels: build.query<OnCallSlackChannelDTO[], void>({
      query: () => ({
        url: getProxyApiUrl('/slack_channels/'),
        params: {
          skip_pagination: true,
        },
        showErrorAlert: false,
      }),
      transformResponse: (response: SlackChannelResult) => {
        if (isPaginatedResponse(response)) {
          return response.results;
        }
        return response;
      },
      providesTags: ['OnCallSlackChannels'],
    }),
  }),
});

function isPaginatedResponse(
  response: AlertReceiveChannelsResult | EscalationChainResult | TeamResult | SlackChannelResult
): response is OnCallPaginatedResult<any> {
  return 'results' in response && Array.isArray(response.results);
}

export const { useGrafanaOnCallIntegrationsQuery } = onCallApi;

export function isOnCallFetchError(error: unknown): error is FetchError<{ detail: string }> {
  return isFetchError(error) && 'detail' in error.data;
}
