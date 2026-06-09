import { HttpResponse, http } from 'msw';

import { setBackendSrv } from '@grafana/runtime';
import { getDashboardMemorySearchHandler } from '@grafana/test-utils/handlers';
import { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import { DASHBOARD_MEMORY_SEARCH_URL, searchDashboardMemory } from './deepSearch';

setBackendSrv(backendSrv);
const server = setupMockServer();

describe('searchDashboardMemory', () => {
  it('unwraps results from the response envelope', async () => {
    server.use(
      getDashboardMemorySearchHandler([
        { dashboardUid: 'dash-1', dashboardTitle: 'API latency', content: 'p99 latency by region', score: 0.21 },
        { dashboardUid: 'dash-2', dashboardTitle: 'Checkout', content: 'checkout errors', score: 0.35, panelId: 4 },
      ])
    );

    const results = await searchDashboardMemory('latency');

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ dashboardUid: 'dash-1', score: 0.21 });
    expect(results[1]).toMatchObject({ dashboardUid: 'dash-2', panelId: 4 });
  });

  it('returns an empty array when the endpoint reports no hits', async () => {
    // The endpoint serializes "no hits" as results: null
    server.use(getDashboardMemorySearchHandler(null));

    expect(await searchDashboardMemory('latency')).toEqual([]);
  });

  it('sends the query and limit as query parameters', async () => {
    let requestUrl: URL | undefined;
    server.use(
      http.get(DASHBOARD_MEMORY_SEARCH_URL, ({ request }) => {
        requestUrl = new URL(request.url);
        return HttpResponse.json({ status: 'success', data: { results: [], total: 0 } });
      })
    );

    await searchDashboardMemory('latency overview', { limit: 40 });

    expect(requestUrl?.searchParams.get('query')).toBe('latency overview');
    expect(requestUrl?.searchParams.get('limit')).toBe('40');
  });

  it('omits the limit parameter when not provided', async () => {
    let requestUrl: URL | undefined;
    server.use(
      http.get(DASHBOARD_MEMORY_SEARCH_URL, ({ request }) => {
        requestUrl = new URL(request.url);
        return HttpResponse.json({ status: 'success', data: { results: [], total: 0 } });
      })
    );

    await searchDashboardMemory('latency');

    expect(requestUrl?.searchParams.has('limit')).toBe(false);
  });
});
