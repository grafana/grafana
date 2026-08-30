import { HttpResponse, http } from 'msw';

import { setBackendSrv } from '@grafana/runtime';
import { getVectorSearchHandler, vectorSearchRoute } from '@grafana/test-utils/handlers';
import { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import { searchDashboardVector } from './deepSearch';

setBackendSrv(backendSrv);
const server = setupMockServer();

describe('searchDashboardVector', () => {
  it('maps hits to flattened panel results', async () => {
    server.use(
      getVectorSearchHandler([
        { name: 'dash-1', title: 'API latency', snippet: 'p99 latency by region', score: 0.21 },
        { name: 'dash-2', title: 'Checkout', snippet: 'checkout errors', score: 0.35, panelId: 4, folder: 'f1' },
      ])
    );

    const results = await searchDashboardVector('latency');

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      dashboardUid: 'dash-1',
      dashboardTitle: 'API latency',
      content: 'p99 latency by region',
      score: 0.21,
    });
    // panelId is parsed out of the hit's `panel/<id>` subresource
    expect(results[1]).toMatchObject({ dashboardUid: 'dash-2', panelId: 4, folderUid: 'f1' });
  });

  it('returns an empty array when the endpoint reports no hits', async () => {
    server.use(getVectorSearchHandler([]));

    expect(await searchDashboardVector('latency')).toEqual([]);
  });

  it('sends the query and limit as query parameters', async () => {
    let requestUrl: URL | undefined;
    server.use(
      http.get(vectorSearchRoute, ({ request }) => {
        requestUrl = new URL(request.url);
        return HttpResponse.json({ totalHits: 0, hits: [] });
      })
    );

    await searchDashboardVector('latency overview', { limit: 40 });

    expect(requestUrl?.searchParams.get('query')).toBe('latency overview');
    expect(requestUrl?.searchParams.get('limit')).toBe('40');
  });

  it('omits the limit parameter when not provided', async () => {
    let requestUrl: URL | undefined;
    server.use(
      http.get(vectorSearchRoute, ({ request }) => {
        requestUrl = new URL(request.url);
        return HttpResponse.json({ totalHits: 0, hits: [] });
      })
    );

    await searchDashboardVector('latency');

    expect(requestUrl?.searchParams.has('limit')).toBe(false);
  });
});
