import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';

import { setBackendSrv } from '@grafana/runtime';
import { getVectorSearchHandler, vectorSearchRoute } from '@grafana/test-utils/handlers';
import { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';

import { type DeepSearchPanelResult } from '../api/deepSearch';

import { getDeepSearchResults, groupDeepSearchResults, useDeepSearchResults } from './deepSearchActions';

jest.mock('app/features/search/service/searcher', () => ({
  getGrafanaSearcher: jest.fn(),
}));

setBackendSrv(backendSrv);
const server = setupMockServer();

function panelResult(overrides: Partial<DeepSearchPanelResult> = {}): DeepSearchPanelResult {
  return {
    dashboardUid: 'dash-1',
    dashboardTitle: 'API latency',
    content: 'p99 latency by region',
    score: 0.2,
    folderTitle: 'Observability',
    ...overrides,
  };
}

describe('groupDeepSearchResults', () => {
  it('groups panel hits into one entry per dashboard', () => {
    const grouped = groupDeepSearchResults([
      panelResult({ content: 'p99 latency', score: 0.1 }),
      panelResult({ content: 'p50 latency', score: 0.1 }),
      panelResult({ dashboardUid: 'dash-2', dashboardTitle: 'Checkout', content: 'checkout errors', score: 0.1 }),
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

  it('keeps dashboards in backend order (first appearance of each dashboard)', () => {
    const grouped = groupDeepSearchResults([
      // Uniform scores so the average filter keeps everything — this isolates ordering
      panelResult({ dashboardUid: 'dash-2', score: 0.1 }),
      panelResult({ dashboardUid: 'dash-1', score: 0.1 }),
      panelResult({ dashboardUid: 'dash-1', score: 0.1 }),
      panelResult({ dashboardUid: 'dash-3', score: 0.1 }),
    ]);

    expect(grouped.map((g) => g.dashboardUid)).toEqual(['dash-2', 'dash-1', 'dash-3']);
  });

  it('caps snippets at MAX_SNIPPETS_PER_DASHBOARD but still counts all matched panels', () => {
    const grouped = groupDeepSearchResults([
      // Equal scores so all four survive the cutoff
      panelResult({ content: 'first', score: 0.2 }),
      panelResult({ content: 'second', score: 0.2 }),
      panelResult({ content: 'third', score: 0.2 }),
      panelResult({ content: 'fourth', score: 0.2 }),
    ]);

    expect(grouped[0].snippets).toEqual([
      { text: 'first', score: 0.2 },
      { text: 'second', score: 0.2 },
      { text: 'third', score: 0.2 },
    ]);
    // matchedPanelCount tracks every survivor, so the UI can show "N more matched panels"
    expect(grouped[0].matchedPanelCount).toBe(4);
  });

  it('sorts surviving panel snippets by score (best first) and caps at 2', () => {
    const grouped = groupDeepSearchResults([
      // 'far' (0.9) is above the average and dropped; the rest are sorted best-first
      panelResult({ content: 'second', score: 0.2 }),
      panelResult({ content: 'first', score: 0.1 }),
      panelResult({ content: 'far', score: 0.9 }),
    ]);

    expect(grouped[0].snippets).toEqual([
      { text: 'first', score: 0.1 },
      { text: 'second', score: 0.2 },
    ]);
  });

  it('global scope: cutoff is the min/max midpoint, not the mean, and removes weak dashboards', () => {
    const grouped = groupDeepSearchResults(
      [
        panelResult({ dashboardUid: 'dash-1', content: 'best', score: 0.1 }),
        panelResult({ dashboardUid: 'dash-1', content: 'good', score: 0.1 }),
        panelResult({ dashboardUid: 'dash-1', content: 'mid', score: 0.4 }),
        panelResult({ dashboardUid: 'dash-2', content: 'worst', score: 0.9 }),
      ],
      'global'
    );

    // Midpoint = (0.1 + 0.9) / 2 = 0.5, whereas the mean would be 0.375.
    // dash-1's 0.4 panel survives under the midpoint (it would be dropped under the mean),
    // so matchedPanelCount is 3. dash-2's only panel (0.9) is past 0.5, so dash-2 disappears.
    expect(grouped.map((g) => g.dashboardUid)).toEqual(['dash-1']);
    expect(grouped[0].matchedPanelCount).toBe(3);
    expect(grouped[0].snippets.map((s) => s.text)).toEqual(['best', 'good', 'mid']);
  });

  it('per-dashboard scope: each card keeps only its own better-than-average panels', () => {
    const grouped = groupDeepSearchResults(
      [
        panelResult({ dashboardUid: 'dash-1', content: 'best', score: 0.1 }),
        panelResult({ dashboardUid: 'dash-1', content: 'mid', score: 0.2 }),
        panelResult({ dashboardUid: 'dash-1', content: 'worst', score: 0.6 }),
        panelResult({ dashboardUid: 'dash-2', content: 'only', score: 0.5 }),
      ],
      'per-dashboard'
    );

    // dash-1 average = 0.3 → keeps 0.1 and 0.2. dash-2 averages its single panel, so it
    // survives (unlike global scope) keeping its one panel.
    expect(grouped.map((g) => g.dashboardUid)).toEqual(['dash-1', 'dash-2']);
    expect(grouped[0].matchedPanelCount).toBe(2);
    expect(grouped[0].snippets.map((s) => s.text)).toEqual(['best', 'mid']);
    expect(grouped[1].matchedPanelCount).toBe(1);
  });

  it('strips the redundant folder and dashboard title from snippet breadcrumbs and hoists tags', () => {
    const grouped = groupDeepSearchResults([
      panelResult({
        dashboardUid: 'dash-1',
        // The hit title is `dashboardTitle — panelTitle` (titles may contain " — ")
        dashboardTitle: 'Kafka — Broker & Consumer Lag — Consumer group lag',
        folderTitle: 'Streaming',
        content:
          'Streaming → Kafka — Broker & Consumer Lag → Consumer group lag → Offset lag per group.\nTags: infra, prod',
      }),
    ]);

    // The card title is the bare dashboard name, with the panel suffix dropped
    expect(grouped[0].title).toBe('Kafka — Broker & Consumer Lag');
    // Folder ("Streaming") and dashboard ("Kafka — Broker & Consumer Lag") segments are dropped;
    // panel title and description are kept, and the "Tags:" line is removed from the snippet text
    expect(grouped[0].snippets).toEqual([{ text: 'Consumer group lag → Offset lag per group.', score: 0.2 }]);
    // Tags are parsed out and surfaced at the dashboard level (rendered as pills)
    expect(grouped[0].tags).toEqual(['infra', 'prod']);
  });

  it('drops the trailing query expression lines from the snippet', () => {
    const grouped = groupDeepSearchResults([
      panelResult({
        dashboardTitle: 'Prometheus — Node & Service Metrics — Node CPU utilization',
        folderTitle: 'Infrastructure',
        content:
          'Prometheus — Node & Service Metrics → Node CPU utilization → Per-instance CPU busy percentage.\n' +
          'Tags: prometheus\n' +
          '100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)',
      }),
    ]);

    // Only the breadcrumb (minus the dashboard prefix) survives — the Tags and PromQL lines are gone
    expect(grouped[0].snippets).toEqual([
      { text: 'Node CPU utilization → Per-instance CPU busy percentage.', score: 0.2 },
    ]);
    expect(grouped[0].tags).toEqual(['prometheus']);
  });

  it('keeps a snippet unchanged when it has no redundant breadcrumb prefix and reports no tags', () => {
    const grouped = groupDeepSearchResults([
      panelResult({ dashboardTitle: 'API latency', folderTitle: 'Observability', content: 'p99 latency by region' }),
    ]);

    expect(grouped[0].snippets).toEqual([{ text: 'p99 latency by region', score: 0.2 }]);
    expect(grouped[0].tags).toEqual([]);
  });

  it('skips hits without a dashboard uid and empty snippets', () => {
    const grouped = groupDeepSearchResults([
      panelResult({ dashboardUid: '' }),
      panelResult({ content: '' }),
      panelResult({ content: 'real content' }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].snippets).toEqual([{ text: 'real content', score: 0.2 }]);
    expect(grouped[0].matchedPanelCount).toBe(2);
  });
});

describe('getDeepSearchResults', () => {
  it('fetches, groups and keeps backend order', async () => {
    server.use(
      getVectorSearchHandler([
        { name: 'dash-1', title: 'API latency', snippet: 'p99', score: 0.1 },
        { name: 'dash-2', title: 'Checkout', snippet: 'errors', score: 0.2 },
        { name: 'dash-2', title: 'Checkout', snippet: 'timeouts', score: 0.3 },
      ])
    );

    const results = await getDeepSearchResults('latency');

    // dash-1's best hit comes first in the backend response, so it ranks first
    expect(results.map((r) => r.dashboardUid)).toEqual(['dash-1', 'dash-2']);
  });

  it('resolves folder titles from the folder lookup', async () => {
    (getGrafanaSearcher as jest.Mock).mockReturnValue({
      getLocationInfo: async () => ({ f1: { name: 'Observability', kind: 'folder', url: '' } }),
    });
    server.use(
      getVectorSearchHandler([{ name: 'dash-1', title: 'API latency', snippet: 'p99', score: 0.1, folder: 'f1' }])
    );

    const results = await getDeepSearchResults('latency');

    expect(results[0].folderTitle).toBe('Observability');
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
      getVectorSearchHandler([
        // Equal scores so both panels survive the average filter
        { name: 'dash-1', title: 'API latency', snippet: 'p99 latency', score: 0.1 },
        { name: 'dash-1', title: 'API latency', snippet: 'p50 latency', score: 0.1 },
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
    server.use(http.get(vectorSearchRoute, () => HttpResponse.json({}, { status: 500 })));

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
