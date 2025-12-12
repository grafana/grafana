import { SupportedPlugin } from '../types/pluginBridges';

import { alertingApi } from './alertingApi';

interface IncidentsPluginConfigDto {
  isChatOpsInstalled: boolean;
  isIncidentCreated: boolean;
}

const getProxyApiUrl = (path: string, pluginId: SupportedPlugin) => `/api/plugins/${pluginId}/resources${path}`;

export const incidentsApi = (pluginId: SupportedPlugin) =>
  alertingApi.injectEndpoints({
    endpoints: (build) => ({
      getIncidentsPluginConfig: build.query<IncidentsPluginConfigDto, void>({
        query: () => ({
          url: getProxyApiUrl('/api/ConfigurationTrackerService.GetConfigurationTracker', pluginId),
          data: {},
          method: 'POST',
          showErrorAlert: false,
        }),
      }),
    }),
  });
