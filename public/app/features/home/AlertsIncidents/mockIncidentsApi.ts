import { http, HttpResponse } from 'msw';

import server from '@grafana/test-utils/server';
import { type IncidentPreview } from 'app/features/alerting/unified/api/incidentsApi';

export const QUERY_PREVIEWS_PATH = '/api/plugins/:pluginId/resources/api/v1/IncidentsService.QueryIncidentPreviews';
export const GET_FIELDS_PATH = '/api/plugins/:pluginId/resources/api/v1/FieldsService.GetFields';
export const ACTIVE_INCIDENTS_QUERY = 'isdrill:false status:active';

interface QueryPreviewsRequest {
  query: { queryString: string };
}

/**
 * Mocks the incident previews endpoint and returns the `queryString` of each request received.
 * Pass a function to answer per query, e.g. an empty list for one team.
 */
export function mockIncidents(
  incidents: IncidentPreview[] | ((queryString: string) => IncidentPreview[]),
  { hasMore = false } = {}
) {
  const queries: string[] = [];
  server.use(
    http.post<never, QueryPreviewsRequest>(QUERY_PREVIEWS_PATH, async ({ request }) => {
      const body = await request.json();
      queries.push(body.query.queryString);
      const incidentPreviews = typeof incidents === 'function' ? incidents(body.query.queryString) : incidents;
      return HttpResponse.json({ incidentPreviews, cursor: { hasMore, nextValue: hasMore ? 'next' : '' } });
    })
  );
  return queries;
}

/** Org custom fields with a `team` select field offering the given values. */
export function mockIncidentTeamField(values: string[]) {
  server.use(
    http.post(GET_FIELDS_PATH, () =>
      HttpResponse.json({
        fields: [
          { slug: 'severity', archived: false, selectoptions: [{ value: 'Critical' }] },
          {
            slug: 'team',
            archived: false,
            // A blank value and one with both quote kinds; neither can be offered as an option.
            selectoptions: [...values.map((value) => ({ value })), { value: '  ' }, { value: `Ops "A" 'B'` }],
          },
        ],
      })
    )
  );
}

/** Org with no custom fields at all, so the incidents team dropdown stays hidden. */
export function mockNoIncidentFields() {
  server.use(http.post(GET_FIELDS_PATH, () => HttpResponse.json({ fields: [] })));
}
