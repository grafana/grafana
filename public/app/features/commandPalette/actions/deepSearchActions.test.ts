import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';

import { setBackendSrv } from '@grafana/runtime';
import { getDashboardMemorySearchHandler } from '@grafana/test-utils/handlers';
import { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import { DASHBOARD_MEMORY_SEARCH_URL, type DashboardMemorySearchResult } from '../api/deepSearch';

import { getDeepSearchResults, groupDashboardMemoryResults, useDeepSearchResults } from './deepSearchActions';

setBackendSrv(backendSrv);
const server = setupMockServer();

function panelHit(overrides: Partial<DashboardMemorySearchResult> = {}): DashboardMemorySearchResult {
  return {
    dashboardUid: 'dash-1',
    dashboardTitle: 'API latency',
    content: 'p99 latency by region',
    score: 0.2,
    folderTitle: 'Observability',
    ...overrides,
  };
}

describe('groupDashboardMemoryResults', () => {
  it('groups panel hits into one entry per dashboard', () => {
    const grouped = groupDashboardMemoryResults([
      panelHit({ content: 'p99 latency', score: 0.1 }),
      panelHit({ content: 'p50 latency', score: 0.2 }),
      panelHit({ dashboardUid: 'dash-2', dashboardTitle: 'Checkout', content: 'checkout errors', score: 0.15 }),
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped.map((g) => g.dashboardUid)).toEqual(['dash-1', 'dash-2']);
    expect(grouped[0]).toMatchObject({
      title: 'API latency',
      url: '/d/dash-1',
      folderTitle: 'Observability',
      matchedPanelCount: 2,
      bestScore: 0.1,
    });
  });

  it('ranks by matched panel count, then by best score', () => {
    const grouped = groupDashboardMemoryResults([
      // dash-1: 1 hit with the single best score
      panelHit({ dashboardUid: 'dash-1', score: 0.05 }),
      // dash-2 and dash-3: 2 hits each; dash-3 has the better best score
      panelHit({ dashboardUid: 'dash-2', score: 0.2 }),
      panelHit({ dashboardUid: 'dash-2', score: 0.4 }),
      panelHit({ dashboardUid: 'dash-3', score: 0.1 }),
      panelHit({ dashboardUid: 'dash-3', score: 0.5 }),
    ]);

    expect(grouped.map((g) => g.dashboardUid)).toEqual(['dash-3', 'dash-2', 'dash-1']);
  });

  it('keeps at most 3 snippets per dashboard in arrival (best-first) order', () => {
    const grouped = groupDashboardMemoryResults([
      panelHit({ content: 'first', score: 0.1 }),
      panelHit({ content: 'second', score: 0.2 }),
      panelHit({ content: 'third', score: 0.3 }),
      panelHit({ content: 'fourth', score: 0.4 }),
    ]);

    expect(grouped[0].snippets).toEqual(['first', 'second', 'third']);
    expect(grouped[0].matchedPanelCount).toBe(4);
  });

  it('skips hits without a dashboard uid and empty snippets', () => {
    const grouped = groupDashboardMemoryResults([
      panelHit({ dashboardUid: '' }),
      panelHit({ content: '' }),
      panelHit({ content: 'real content' }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].snippets).toEqual(['real content']);
    expect(grouped[0].matchedPanelCount).toBe(2);
  });
});

describe('getDeepSearchResults', () => {
  it('fetches, groups and ranks results', async () => {
    server.use(
      getDashboardMemorySearchHandler([
        panelHit({ dashboardUid: 'dash-1', score: 0.1 }),
        panelHit({ dashboardUid: 'dash-2', dashboardTitle: 'Checkout', score: 0.2 }),
        panelHit({ dashboardUid: 'dash-2', dashboardTitle: 'Checkout', score: 0.3 }),
      ])
    );

    const results = await getDeepSearchResults('latency');

    expect(results.map((r) => r.dashboardUid)).toEqual(['dash-2', 'dash-1']);
  });

  it('returns empty results for a blank query without calling the API', async () => {
    let called = false;
    server.events.on('request:start', () => {
      called = true;
    });

    expect(await getDeepSearchResults('   ')).toEqual([]);
    expect(called).toBe(false);
  });
});

describe('useDeepSearchResults', () => {
  afterEach(() => {
    server.events.removeAllListeners();
  });

  it('returns empty results when the search query is empty', () => {
    const { result } = renderHook(() => useDeepSearchResults({ searchQuery: '', show: true, enabled: true }));

    expect(result.current.deepSearchResults).toEqual([]);
    expect(result.current.isFetchingDeepSearchResults).toBe(false);
  });

  it('returns empty results when show is false', () => {
    const { result } = renderHook(() => useDeepSearchResults({ searchQuery: 'latency', show: false, enabled: true }));

    expect(result.current.deepSearchResults).toEqual([]);
    expect(result.current.isFetchingDeepSearchResults).toBe(false);
  });

  it('does not call the API when disabled', async () => {
    let called = false;
    server.events.on('request:start', () => {
      called = true;
    });

    const { result } = renderHook(() => useDeepSearchResults({ searchQuery: 'latency', show: true, enabled: false }));

    expect(result.current.deepSearchResults).toEqual([]);
    expect(result.current.isFetchingDeepSearchResults).toBe(false);
    // Debounce means a request would only fire after a delay; give it time to prove it doesn't
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(called).toBe(false);
  });

  it('fetches and returns grouped results', async () => {
    server.use(
      getDashboardMemorySearchHandler([
        panelHit({ dashboardUid: 'dash-1', score: 0.1 }),
        panelHit({ dashboardUid: 'dash-1', content: 'p50 latency', score: 0.3 }),
      ])
    );

    const { result } = renderHook(() => useDeepSearchResults({ searchQuery: 'latency', show: true, enabled: true }));

    expect(result.current.isFetchingDeepSearchResults).toBe(true);
    await waitFor(
      () => {
        expect(result.current.deepSearchResults).toEqual([
          expect.objectContaining({ dashboardUid: 'dash-1', matchedPanelCount: 2 }),
        ]);
      },
      { timeout: 3000 }
    );
    expect(result.current.isFetchingDeepSearchResults).toBe(false);
  });

  it('degrades to empty results and logs when the endpoint fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    server.use(http.get(DASHBOARD_MEMORY_SEARCH_URL, () => HttpResponse.json({}, { status: 500 })));

    const { result } = renderHook(() => useDeepSearchResults({ searchQuery: 'latency', show: true, enabled: true }));

    expect(result.current.isFetchingDeepSearchResults).toBe(true);
    await waitFor(
      () => {
        expect(result.current.isFetchingDeepSearchResults).toBe(false);
      },
      { timeout: 3000 }
    );
    expect(result.current.deepSearchResults).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Deep search failed'), expect.anything());
    consoleErrorSpy.mockRestore();
  });
});
