import { waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';

import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { configureStore } from 'app/store/configureStore';

import { searchDashboardsHybrid } from './hybridSearch';

setBackendSrv(backendSrv);
const server = setupMockServer();
const hybridSearchRoute = '/apis/dashboard.grafana.app/v0alpha1/namespaces/:namespace/dashboards/search/hybrid';

describe('searchDashboardsHybrid', () => {
  beforeEach(() => {
    configureStore();
  });

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

  it('refetches repeated queries so newly indexed dashboards can appear', async () => {
    const hit = {
      resource: { group: 'dashboard.grafana.app', resource: 'dashboards', kind: 'Dashboard', name: 'new-dashboard' },
      title: 'New dashboard',
      folder: '',
      score: 1,
      chunks: [],
    };
    let items: unknown[] = [];
    server.use(http.post(hybridSearchRoute, () => HttpResponse.json({ items })));

    expect(await searchDashboardsHybrid('latency')).toEqual([]);
    items = [hit];
    expect(await searchDashboardsHybrid('latency')).toEqual([hit]);
  });

  it('forwards cancellation to the HTTP request', async () => {
    const fetchSpy = jest.spyOn(backendSrv, 'fetch');
    const controller = new AbortController();
    let respond: (response: Response) => void = () => {};
    const response = new Promise<Response>((resolve) => {
      respond = resolve;
    });
    server.use(http.post(hybridSearchRoute, () => response));

    try {
      const search = searchDashboardsHybrid('latency', { abortSignal: controller.signal });
      await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
      controller.abort();

      await expect(search).rejects.toMatchObject({ name: 'AbortError' });
      expect(fetchSpy.mock.calls[0][0].abortSignal?.aborted).toBe(true);
    } finally {
      respond(HttpResponse.json({ items: [] }));
      fetchSpy.mockRestore();
    }
  });
});
