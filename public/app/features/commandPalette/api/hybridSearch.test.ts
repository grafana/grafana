import { HttpResponse, http } from 'msw';

import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import { searchDashboardsHybrid } from './hybridSearch';

setBackendSrv(backendSrv);
const server = setupMockServer();
const hybridSearchRoute = '/apis/dashboard.grafana.app/v0alpha1/namespaces/:namespace/dashboards/search/hybrid';

describe('searchDashboardsHybrid', () => {
  it('posts the hybrid query envelope and returns resource items in server order', async () => {
    let requestBody: unknown;
    const items = [
      {
        resource: { group: 'dashboard.grafana.app', resource: 'dashboards', kind: 'Dashboard', name: 'latency' },
        title: 'API latency',
        folder: 'observability',
        folderTitle: 'Observability',
        managedBy: { kind: 'repo', id: 'repository-1' },
        score: 0.9,
        chunks: [{ subresource: 'panel/4', content: 'p99 latency by region' }],
      },
      {
        resource: { group: 'dashboard.grafana.app', resource: 'dashboards', kind: 'Dashboard', name: 'checkout' },
        title: 'Checkout',
        folder: '',
        score: 0.5,
        chunks: [{ subresource: '', content: 'Checkout' }],
      },
    ];
    server.use(
      http.post(hybridSearchRoute, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ apiVersion: 'search.grafana.app/v0alpha1', kind: 'HybridSearchResults', items });
      })
    );

    const results = await searchDashboardsHybrid('latency overview', { limit: 20 });

    expect(requestBody).toEqual({
      apiVersion: 'search.grafana.app/v0alpha1',
      kind: 'HybridSearchQuery',
      query: 'latency overview',
      limit: 20,
    });
    expect(results).toEqual(items);
  });

  it('omits an unspecified limit and returns an empty array for no matches', async () => {
    let requestBody: unknown;
    server.use(
      http.post(hybridSearchRoute, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ apiVersion: 'search.grafana.app/v0alpha1', kind: 'HybridSearchResults', items: [] });
      })
    );

    expect(await searchDashboardsHybrid('latency')).toEqual([]);
    expect(requestBody).toEqual({
      apiVersion: 'search.grafana.app/v0alpha1',
      kind: 'HybridSearchQuery',
      query: 'latency',
    });
  });
});
