import { HttpResponse, http } from 'msw';

export const DASHBOARD_MEMORY_SEARCH_URL = '/api/plugins/grafana-assistant-app/resources/api/v1/memory/dashboards';

/**
 * Mocks the assistant plugin's dashboard memory (semantic search) endpoint.
 * Responses use the plugin's envelope: `{ status, data: { results, total } }`,
 * where `results` is null (not an empty array) when there are no hits.
 */
export const getDashboardMemorySearchHandler = (results: Array<Record<string, unknown>> | null = []) =>
  http.get(DASHBOARD_MEMORY_SEARCH_URL, () =>
    HttpResponse.json({
      status: 'success',
      data: { results, total: results?.length ?? 0 },
    })
  );

export default [getDashboardMemorySearchHandler()];
