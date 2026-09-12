import { alertingApi } from './alertingApi';

export const ACTIVE_INCIDENTS_QUERY_LIMIT = 50;

interface IncidentsPluginConfigDto {
  isChatOpsInstalled: boolean;
  isIncidentCreated: boolean;
}

// Subset of the Grafana Incident API's IncidentPreview — only the fields the home-page card consumes.
export interface IncidentPreview {
  incidentID: string;
  title: string;
  // Org-configurable label (e.g. "critical" | "major" | "minor" | "pending"), so it stays a free string.
  severityLabel: string;
  createdTime: string; // RFC 3339
}

interface QueryIncidentPreviewsResponse {
  incidentPreviews?: IncidentPreview[];
  // Pagination cursor: hasMore means the server truncated the result at the requested limit.
  cursor?: { hasMore?: boolean };
  error?: string;
}

export interface ActiveIncidents {
  incidents: IncidentPreview[];
  /** True when there are more active incidents than the query limit allowed the server to return. */
  hasMore: boolean;
}

/**
 * The Incident API has no attachment method: context is attached to an existing incident by posting
 * an activity item whose body mentions a URL, which the backend parses out and attaches.
 */
export interface AddIncidentActivityArgs {
  pluginId: string;
  incidentID: string;
  /** Free text. Any URL in here becomes attached context on the incident. Capped at 65536 by the API. */
  body: string;
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
    getActiveIncidents: build.query<ActiveIncidents, { pluginId: string }>({
      query: ({ pluginId }) => ({
        url: getProxyApiUrl('/api/v1/IncidentsService.QueryIncidentPreviews', pluginId),
        data: {
          query: {
            queryString: 'isdrill:false status:active',
            orderField: 'createdTime',
            orderDirection: 'DESC',
            limit: ACTIVE_INCIDENTS_QUERY_LIMIT,
          },
        },
        method: 'POST',
        showErrorAlert: false,
      }),
      transformResponse: (response: QueryIncidentPreviewsResponse): ActiveIncidents => ({
        incidents: response.incidentPreviews ?? [],
        hasMore: response.cursor?.hasMore ?? false,
      }),
    }),
    addIncidentActivity: build.mutation<void, AddIncidentActivityArgs>({
      query: ({ pluginId, incidentID, body }) => ({
        url: getProxyApiUrl('/api/v1/ActivityService.AddActivity', pluginId),
        // userNote is the only activityKind the API documents for callers; the rest are written by
        // Incident itself as the incident progresses.
        data: { incidentID, activityKind: 'userNote', body },
        method: 'POST',
        // Left on, unlike the queries above: they suppress it because an org without an incident
        // record is a normal absence, but this is a write somebody asked for and has to report.
      }),
    }),
  }),
});
