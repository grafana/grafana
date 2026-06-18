import { alertingApi } from './alertingApi';

interface IncidentsPluginConfigDto {
  isChatOpsInstalled: boolean;
  isIncidentCreated: boolean;
}

// Subset of IncidentPreview (Grafana Incident API) modelled for the home-page card; the full type has ~20 fields we don't use.
export interface IncidentPreview {
  incidentID: string;
  title: string;
  slug: string;
  status: 'active' | 'resolved';
  // Org-configurable label (e.g. "critical" | "major" | "minor" | "pending"), so it stays a free string.
  severityLabel: string;
  isDrill: boolean;
  createdTime: string; // RFC 3339
  incidentStart: string; // RFC 3339
}

interface QueryIncidentPreviewsResponse {
  incidentPreviews?: IncidentPreview[];
  error?: string;
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
    getActiveIncidents: build.query<IncidentPreview[], { pluginId: string }>({
      query: ({ pluginId }) => ({
        url: getProxyApiUrl('/api/v1/IncidentsService.QueryIncidentPreviews', pluginId),
        data: {
          query: {
            queryString: 'isdrill:false status:active',
            orderField: 'createdTime',
            orderDirection: 'DESC',
            limit: 50,
          },
        },
        method: 'POST',
        showErrorAlert: false,
      }),
      transformResponse: (response: QueryIncidentPreviewsResponse) => response.incidentPreviews ?? [],
    }),
  }),
});
