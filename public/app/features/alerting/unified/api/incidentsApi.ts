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

// Subset of the Incident API's custom-field definitions — only what's needed to list the `team` options.
// GetFields returns archived fields but already drops archived select options server-side.
interface IncidentFieldDto {
  slug: string;
  archived?: boolean;
  selectoptions?: Array<{ value: string }>;
}

interface GetFieldsResponse {
  fields?: IncidentFieldDto[];
}

const ACTIVE_INCIDENTS_QUERY = 'isdrill:false status:active';

// No escape form in the Incident lexer, so use the quote the value lacks.
function quoteQueryValue(value: string) {
  return value.includes('"') ? `'${value}'` : `"${value}"`;
}

// A value with both quote kinds can't be quoted, so it's never offered as an option.
// Blank values would render as an empty row and '' collides with the default-scope selection.
function isFilterableTeamValue(value: string) {
  return value.trim() !== '' && !(value.includes('"') && value.includes("'"));
}

function buildActiveIncidentsQuery(team?: string) {
  return team ? `${ACTIVE_INCIDENTS_QUERY} field:team:${quoteQueryValue(team)}` : ACTIVE_INCIDENTS_QUERY;
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
    getActiveIncidents: build.query<ActiveIncidents, { pluginId: string; team?: string }>({
      query: ({ pluginId, team }) => ({
        url: getProxyApiUrl('/api/v1/IncidentsService.QueryIncidentPreviews', pluginId),
        data: {
          query: {
            queryString: buildActiveIncidentsQuery(team),
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
    // Values of the org's `team` custom field; empty when the org has no such field.
    getIncidentTeamValues: build.query<string[], { pluginId: string }>({
      query: ({ pluginId }) => ({
        url: getProxyApiUrl('/api/v1/FieldsService.GetFields', pluginId),
        data: {},
        method: 'POST',
        showErrorAlert: false,
      }),
      transformResponse: (response: GetFieldsResponse): string[] => {
        const teamField = response.fields?.find((field) => field.slug === 'team' && !field.archived);
        return (teamField?.selectoptions ?? []).map((option) => option.value).filter(isFilterableTeamValue);
      },
    }),
  }),
});
