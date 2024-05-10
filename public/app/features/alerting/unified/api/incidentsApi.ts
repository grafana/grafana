import { SupportedPlugin } from '../types/pluginBridges';

import { alertingApi } from './alertingApi';

interface IncidentsPluginConfigDto {
  isChatOpsInstalled: boolean;
  isIncidentCreated: boolean;
}

const getProxyApiUrl = (path: string) =>
  `/api/plugins/grafana-incident-app/resources/${SupportedPlugin.Incident}${path}`;

export const incidentsApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    getIncidentsPluginConfig: build.query<IncidentsPluginConfigDto, void>({
      query: (integration) => ({
        url: getProxyApiUrl('/api/internal/v1/organization/config-checks/'),
        method: 'POST',
        showErrorAlert: false,
      }),
    }),
  }),
});
