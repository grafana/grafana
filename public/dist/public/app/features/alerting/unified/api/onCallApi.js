import { isFetchError } from '@grafana/runtime';
import { GRAFANA_ONCALL_INTEGRATION_TYPE } from '../components/receivers/grafanaAppReceivers/onCall/onCall';
import { SupportedPlugin } from '../types/pluginBridges';
import { alertingApi } from './alertingApi';
export const ONCALL_INTEGRATION_V2_FEATURE = 'grafana_alerting_v2';
const getProxyApiUrl = (path) => `/api/plugin-proxy/${SupportedPlugin.OnCall}${path}`;
export const onCallApi = alertingApi.injectEndpoints({
    endpoints: (build) => ({
        grafanaOnCallIntegrations: build.query({
            query: () => ({
                url: getProxyApiUrl('/api/internal/v1/alert_receive_channels/'),
                // legacy_grafana_alerting is necessary for OnCall.
                // We do NOT need to differentiate between these two on our side
                params: { filters: true, integration: [GRAFANA_ONCALL_INTEGRATION_TYPE, 'legacy_grafana_alerting'] },
            }),
            transformResponse: (response) => {
                if (isPaginatedResponse(response)) {
                    return response.results;
                }
                return response;
            },
            providesTags: ['OnCallIntegrations'],
        }),
        validateIntegrationName: build.query({
            query: (name) => ({
                url: getProxyApiUrl('/api/internal/v1/alert_receive_channels/validate_name/'),
                params: { verbal_name: name },
                showErrorAlert: false,
            }),
        }),
        createIntegration: build.mutation({
            query: (integration) => ({
                url: getProxyApiUrl('/api/internal/v1/alert_receive_channels/'),
                data: integration,
                method: 'POST',
                showErrorAlert: true,
            }),
            invalidatesTags: ['OnCallIntegrations'],
        }),
        features: build.query({
            query: () => ({
                url: getProxyApiUrl('/api/internal/v1/features/'),
            }),
        }),
    }),
});
function isPaginatedResponse(response) {
    return 'results' in response && Array.isArray(response.results);
}
export const { useGrafanaOnCallIntegrationsQuery } = onCallApi;
export function isOnCallFetchError(error) {
    return isFetchError(error) && 'detail' in error.data;
}
//# sourceMappingURL=onCallApi.js.map