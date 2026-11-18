import { HttpResponse, http } from 'msw';

import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { dashboardAPIv0alpha1 } from 'app/api/clients/dashboard/v0alpha1';
import { backendSrv } from 'app/core/services/backend_srv';
import { configureStore } from 'app/store/configureStore';
import { dispatch } from 'app/types/store';

import { searchDashboardsHybrid } from './hybridSearch';

setBackendSrv(backendSrv);
const server = setupMockServer();
const hybridSearchRoute = '/apis/dashboard.grafana.app/v0alpha1/namespaces/:namespace/dashboards/search/hybrid';

describe('searchDashboardsHybrid', () => {
  beforeEach(() => {
    configureStore();
    setTestFlags({});
  });

  afterAll(() => {
    setTestFlags({});
  });

  it('posts the hybrid query envelope and returns resource items in server order', async () => {
    let requestBody: unknown;
    let callerID: string | null = null;
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
        callerID = request.headers.get('X-Grafana-Caller-Id');
        return HttpResponse.json({ apiVersion: 'search.grafana.app/v0alpha1', kind: 'HybridSearchResults', items });
      })
    );

    const results = await searchDashboardsHybrid('latency overview', { limit: 20 });

    expect(requestBody).toEqual({
      apiVersion: 'search.grafana.app/v0alpha1',
      kind: 'HybridSearchQuery',
      query: 'latency overview',
      skipRerank: false,
      limit: 20,
    });
    expect(callerID).toBe('cmdk');
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
      skipRerank: false,
    });
  });

  it('leaves the generated dashboard hybrid search request unmarked', async () => {
    let callerID: string | null = null;
    let requestBody: unknown;
    server.use(
      http.post(hybridSearchRoute, async ({ request }) => {
        callerID = request.headers.get('X-Grafana-Caller-Id');
        requestBody = await request.json();
        return HttpResponse.json({ items: [] });
      })
    );

    await dispatch(
      dashboardAPIv0alpha1.endpoints.listDashboardHybridSearchV0Alpha1.initiate(
        {
          hybridSearchQuery: {
            apiVersion: 'search.grafana.app/v0alpha1',
            kind: 'HybridSearchQuery',
            query: 'outside cmdk',
          },
        },
        { subscribe: false, forceRefetch: true }
      )
    ).unwrap();

    expect(requestBody).toEqual({
      apiVersion: 'search.grafana.app/v0alpha1',
      kind: 'HybridSearchQuery',
      query: 'outside cmdk',
    });
    expect(callerID).toBeNull();
  });

  it.each([true, false])('sends skipRerank=%s from the command palette feature flag', async (skipRerank) => {
    setTestFlags({ 'grafana.cmdkHybridSearchSkipRerank': skipRerank });
    let requestBody: unknown;
    server.use(
      http.post(hybridSearchRoute, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ items: [] });
      })
    );

    await searchDashboardsHybrid('latency', { limit: 20 });

    expect(requestBody).toEqual({
      apiVersion: 'search.grafana.app/v0alpha1',
      kind: 'HybridSearchQuery',
      query: 'latency',
      limit: 20,
      skipRerank,
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

  it('preserves the HTTP status when the hybrid endpoint is missing', async () => {
    server.use(http.post(hybridSearchRoute, () => HttpResponse.json({}, { status: 404 })));

    await expect(searchDashboardsHybrid('latency')).rejects.toMatchObject({ status: 404, data: {} });
  });
});
