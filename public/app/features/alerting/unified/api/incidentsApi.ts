import { alertingApi } from './alertingApi';

interface IncidentsPluginConfigDto {
  isChatOpsInstalled: boolean;
  isIncidentCreated: boolean;
}

export interface ActiveIncident {
  incidentID: string;
  title: string;
  severity: string;
  status: string;
  createdTime: string;
  createdByUser?: { name: string };
}

interface ActiveIncidentsResponse {
  incidents: ActiveIncident[];
  cursor?: { hasMore: boolean; nextValue: string };
}

const getProxyApiUrl = (path: string, pluginId: string) => `/api/plugins/${pluginId}/resources${path}`;

export const incidentsApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    getIncidentsPluginConfig: build.query<IncidentsPluginConfigDto, { pluginId: string }>({
      query: ({ pluginId }) => ({
        url: getProxyApiUrl('/api/ConfigurationTrackerService.GetConfigurationTracker', pluginId),
        data: {},
        method: 'POST',
        showErrorAlert: false,
      }),
    }),
    getActiveIncidents: build.query<ActiveIncidentsResponse, { pluginId: string; limit: number }>({
      query: ({ pluginId, limit }) => ({
        url: getProxyApiUrl('/api/v1/IncidentsService.QueryIncidents', pluginId),
        method: 'POST',
        data: {
          cursor: { hasMore: false, nextValue: '' },
          query: { queryString: 'isdrill:false and status:active', limit, orderDirection: 'DESC' },
        },
        showErrorAlert: false,
      }),
    }),
  }),
});
