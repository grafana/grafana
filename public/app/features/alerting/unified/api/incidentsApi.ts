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

// Subset of the Incident API's custom-field definitions — only what's needed to list filter options.
interface IncidentFieldDto {
  slug: string;
  name: string;
  // 'labels' for the fields the Incident app shows as labels; other custom fields are 'incident'.
  domainName: string;
  archived?: boolean;
  selectoptions?: Array<{ value: string; archived?: boolean }>;
}

interface GetFieldsResponse {
  fields?: IncidentFieldDto[];
  // Label pairs archived org-wide; fields are returned unfiltered, so pickers hide these themselves.
  archived?: Array<{ key: string; value: string }>;
}

/** A custom-field clause to narrow the active-incidents query to. */
export interface IncidentFieldFilter {
  slug: string;
  value: string;
}

/** One value of an incident label field, offered as a filter option. */
export interface IncidentFilterOption extends IncidentFieldFilter {
  fieldName: string;
}

const ACTIVE_INCIDENTS_QUERY = 'isdrill:false status:active';

// No escape form in the Incident lexer, so use the quote the value lacks.
function quoteQueryValue(value: string) {
  return value.includes('"') ? `'${value}'` : `"${value}"`;
}

// A value with both quote kinds can't be quoted, so it's never offered as an option.
// Blank values would render as an empty row and '' collides with the default-scope selection.
function isFilterableValue(value: string) {
  return value.trim() !== '' && !(value.includes('"') && value.includes("'"));
}

// Same rule the Incident app uses to decide what counts as a label. The free-form `tags`
// field (either casing on the wire) isn't curated like the others, so its values aren't offered.
function isLabelField(field: IncidentFieldDto) {
  return !field.archived && field.domainName === 'labels' && field.slug.toLowerCase() !== 'tags';
}

function buildActiveIncidentsQuery(filter?: IncidentFieldFilter) {
  return filter
    ? `${ACTIVE_INCIDENTS_QUERY} field:${filter.slug}:${quoteQueryValue(filter.value)}`
    : ACTIVE_INCIDENTS_QUERY;
}

const labelPairKey = (slug: string, value: string) => `${slug}:${value}`;

// Options that can be offered for one field: live, quotable, and not archived org-wide.
function getFieldFilterOptions(field: IncidentFieldDto, archivedPairs: Set<string>): IncidentFilterOption[] {
  return (field.selectoptions ?? [])
    .filter(
      (option) =>
        !option.archived &&
        isFilterableValue(option.value) &&
        !archivedPairs.has(labelPairKey(field.slug, option.value))
    )
    .map((option) => ({ slug: field.slug, fieldName: field.name, value: option.value }));
}

/** Exported for unit tests; consumers go through the `getIncidentFilterOptions` query. */
export function toIncidentFilterOptions(response: GetFieldsResponse): IncidentFilterOption[] {
  const archivedPairs = new Set((response.archived ?? []).map(({ key, value }) => labelPairKey(key, value)));
  const labelFields = (response.fields ?? []).filter(isLabelField);
  return labelFields.flatMap((field) => getFieldFilterOptions(field, archivedPairs));
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
    getActiveIncidents: build.query<ActiveIncidents, { pluginId: string; filter?: IncidentFieldFilter }>({
      query: ({ pluginId, filter }) => ({
        url: getProxyApiUrl('/api/v1/IncidentsService.QueryIncidentPreviews', pluginId),
        data: {
          query: {
            queryString: buildActiveIncidentsQuery(filter),
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
    // Values of every label field in the org; empty when there are none.
    getIncidentFilterOptions: build.query<IncidentFilterOption[], { pluginId: string }>({
      query: ({ pluginId }) => ({
        url: getProxyApiUrl('/api/v1/FieldsService.GetFields', pluginId),
        data: {},
        method: 'POST',
        showErrorAlert: false,
      }),
      transformResponse: toIncidentFilterOptions,
    }),
  }),
});
