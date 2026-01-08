import { getIrmIfPresentOrIncidentPluginId } from '../utils/config';

import { alertingApi } from './alertingApi';

interface IncidentsPluginConfigDto {
  isChatOpsInstalled: boolean;
  isIncidentCreated: boolean;
}

const getProxyApiUrl = (path: string) => `/api/plugins/${getIrmIfPresentOrIncidentPluginId()}/resources${path}`;

export const incidentsApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    getIncidentsPluginConfig: build.query<IncidentsPluginConfigDto, void>({
      query: () => ({
        url: getProxyApiUrl('/api/ConfigurationTrackerService.GetConfigurationTracker'),
        data: {},
        method: 'POST',
        showErrorAlert: false,
      }),
    }),
  }),
});
