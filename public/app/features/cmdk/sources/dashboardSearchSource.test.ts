import { config, setBackendSrv } from '@grafana/runtime';
import { getCustomSearchHandler } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';

import { createDashboardSearchSource, SECTION_DASHBOARDS } from './dashboardSearchSource';

setBackendSrv(backendSrv);
setupMockServer();

describe('dashboardSearchSource', () => {
  const source = createDashboardSearchSource();

  beforeEach(() => {
    server.use(
      getCustomSearchHandler([
        {
          resource: 'dashboards',
          name: 'my-dashboard-1',
          title: 'My dashboard 1',
          field: {},
        },
      ])
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('provides the folders and dashboards sections up front', () => {
    expect(source.providedSections.map((section) => section.id)).toEqual(['folders', 'dashboards']);
  });

  it('returns no items for the empty query', async () => {
    contextSrv.user.isSignedIn = true;

    expect(await source.query('', new AbortController().signal)).toEqual([]);
  });

  it('returns no items when not signed in and anonymous access is disabled', async () => {
    contextSrv.user.isSignedIn = false;
    config.anonymousEnabled = false;

    expect(await source.query('my', new AbortController().signal)).toEqual([]);
  });

  it('maps search results to navigation items in their sections', async () => {
    contextSrv.user.isSignedIn = true;

    const items = await source.query('my', new AbortController().signal);

    expect(items).toEqual([
      {
        type: 'navigation',
        id: 'go/dashboard/d/my-dashboard-1/my-dashboard-1',
        sectionId: SECTION_DASHBOARDS,
        title: 'My dashboard 1',
        priority: 1,
        href: '/d/my-dashboard-1/my-dashboard-1',
        subtitle: 'Dashboards',
        // Dashboards get a live preview as their detail
        renderDetail: expect.any(Function),
      },
    ]);
  });

  it('returns no items when aborted while debouncing', async () => {
    contextSrv.user.isSignedIn = true;
    const controller = new AbortController();

    const resultPromise = source.query('my', controller.signal);
    controller.abort();

    expect(await resultPromise).toEqual([]);
  });
});
