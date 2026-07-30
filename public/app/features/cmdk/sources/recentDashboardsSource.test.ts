import { setBackendSrv } from '@grafana/runtime';
import { getCustomSearchHandler } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import impressionSrv from 'app/core/services/impression_srv';

import { createRecentDashboardsSource, SECTION_RECENT_DASHBOARDS } from './recentDashboardsSource';

setBackendSrv(backendSrv);
setupMockServer();

describe('recentDashboardsSource', () => {
  let impressionSrvSpy: jest.SpyInstance;
  const signal = () => new AbortController().signal;

  beforeEach(() => {
    impressionSrvSpy = jest.spyOn(impressionSrv, 'getDashboardOpened').mockResolvedValue(['my-dashboard-1']);
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
    jest.restoreAllMocks();
  });

  it('returns no items and does not fetch when not signed in', async () => {
    contextSrv.user.isSignedIn = false;
    const source = createRecentDashboardsSource();

    expect(await source.query('', signal())).toEqual([]);
    expect(impressionSrvSpy).not.toHaveBeenCalled();
  });

  it('returns recent dashboards as navigation items for the empty query', async () => {
    contextSrv.user.isSignedIn = true;
    const source = createRecentDashboardsSource();

    expect(await source.query('', signal())).toEqual([
      {
        type: 'navigation',
        id: 'recent-dashboards/d/my-dashboard-1/my-dashboard-1',
        sectionId: SECTION_RECENT_DASHBOARDS,
        title: 'My dashboard 1',
        priority: 6,
        href: '/d/my-dashboard-1/my-dashboard-1',
      },
    ]);
  });

  it('fuzzy-filters the recent dashboards when typing', async () => {
    contextSrv.user.isSignedIn = true;
    const source = createRecentDashboardsSource();

    expect(await source.query('my dash', signal())).toHaveLength(1);
    expect(await source.query('unrelated', signal())).toEqual([]);
  });

  it('fetches once per palette open and reuses the list while typing', async () => {
    contextSrv.user.isSignedIn = true;
    const source = createRecentDashboardsSource();

    await source.query('', signal());
    await source.query('my', signal());
    expect(impressionSrvSpy).toHaveBeenCalledTimes(1);

    // A new empty query (palette reopened) refreshes the list
    await source.query('', signal());
    expect(impressionSrvSpy).toHaveBeenCalledTimes(2);
  });
});
