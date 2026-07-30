import { render, screen } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { getVectorSearchHandler } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import { createDeepSearchSource, SECTION_DEEP_SEARCH } from './deepSearchSource';

setBackendSrv(backendSrv);
setupMockServer();

// One hit per matched panel; content is the breadcrumb line plus a Tags line, like the real backend returns.
function hit(uid: string, dashboardTitle: string, panelTitle: string, score: number, description?: string) {
  const breadcrumb = [dashboardTitle, panelTitle, description].filter(Boolean).join(' → ');
  return {
    name: uid,
    title: `${dashboardTitle} — ${panelTitle}`,
    snippet: `${breadcrumb}\nTags: monitoring, prod`,
    score,
    panelId: 1,
  };
}

describe('deepSearchSource', () => {
  const source = createDeepSearchSource();
  const signal = () => new AbortController().signal;

  it('provides the deep search section up front', () => {
    expect(source.providedSections.map((section) => section.id)).toEqual([SECTION_DEEP_SEARCH]);
  });

  it('returns no items for an empty query without hitting the backend', async () => {
    expect(await source.query('', signal())).toEqual([]);
    expect(await source.query('   ', signal())).toEqual([]);
  });

  it('maps grouped dashboard results to navigation items with tags', async () => {
    server.use(
      getVectorSearchHandler([
        hit('dash-1', 'My dashboard', 'CPU panel', 0.1),
        hit('dash-1', 'My dashboard', 'Memory panel', 0.15),
        hit('dash-2', 'Other dashboard', 'Some panel', 0.2),
      ])
    );

    const items = await source.query('cpu usage', signal());

    expect(items).toEqual([
      {
        type: 'navigation',
        id: 'deep-search/dash-1',
        sectionId: SECTION_DEEP_SEARCH,
        title: 'My dashboard',
        priority: 0,
        href: '/d/dash-1',
        subtitle: undefined,
        renderDetail: expect.any(Function),
      },
      expect.objectContaining({ id: 'deep-search/dash-2', title: 'Other dashboard' }),
    ]);
  });

  it('renders the matched panel snippets in the item detail', async () => {
    server.use(
      getVectorSearchHandler([
        hit('dash-1', 'My dashboard', 'CPU panel', 0.1, 'Shows the CPU usage'),
        hit('dash-1', 'My dashboard', 'Memory panel', 0.12),
        hit('dash-1', 'My dashboard', 'Disk panel', 0.14),
        hit('dash-1', 'My dashboard', 'Network panel', 0.16),
      ])
    );

    const [item] = await source.query('cpu usage', signal());
    render(<>{item.renderDetail?.()}</>);

    expect(screen.getByText('My dashboard')).toBeInTheDocument();
    // The dashboard title segment is stripped from the snippet breadcrumbs; the panel title and its
    // description render as separate parts of the snippet card
    expect(screen.getByText('CPU panel')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Shows the CPU usage')).toBeInTheDocument();
    expect(screen.getByText('Memory panel')).toBeInTheDocument();
    expect(screen.getByText('Disk panel')).toBeInTheDocument();
    // All matched panels are shown, there is nothing left to summarize
    expect(screen.getByText('Network panel')).toBeInTheDocument();
    expect(screen.queryByText(/more matched panel/)).not.toBeInTheDocument();
    expect(screen.getByText('monitoring')).toBeInTheDocument();
  });

  it('caps the results to 5 dashboards', async () => {
    server.use(
      getVectorSearchHandler(
        Array.from({ length: 8 }, (_, index) => hit(`dash-${index}`, `Dashboard ${index}`, 'Panel', 0.1))
      )
    );

    const items = await source.query('anything', signal());

    expect(items).toHaveLength(5);
  });

  it('returns no items when aborted while debouncing, without hitting the backend', async () => {
    const controller = new AbortController();

    const resultPromise = source.query('cpu', controller.signal);
    controller.abort();

    expect(await resultPromise).toEqual([]);
  });

  it('treats backend errors as no results', async () => {
    server.use(getVectorSearchHandler());
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(backendSrv, 'get').mockRejectedValueOnce(new Error('vector backend unavailable'));

    expect(await source.query('cpu', signal())).toEqual([]);

    consoleSpy.mockRestore();
  });
});
