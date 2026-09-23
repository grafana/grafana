import impressionSrv from 'app/core/services/impression_srv';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { type DashboardQueryResult } from 'app/features/search/service/types';

import { getRecentlyViewedDashboards } from './recentlyViewed';

jest.mock('app/features/search/service/searcher', () => ({
  getGrafanaSearcher: jest.fn(),
}));

jest.mock('app/core/services/impression_srv', () => ({
  __esModule: true,
  default: {
    getDashboardOpened: jest.fn(),
  },
}));

const getDashboardOpenedMock = jest.mocked(impressionSrv.getDashboardOpened);
const getGrafanaSearcherMock = jest.mocked(getGrafanaSearcher);

function hit(uid: string): DashboardQueryResult {
  return { uid, name: uid, url: `/d/${uid}` } as DashboardQueryResult;
}

/** Stubs the searcher so it responds with `hits`, and records the query it was called with. */
function setupSearcher(hits: DashboardQueryResult[]) {
  const search = jest.fn().mockResolvedValue({ view: { toArray: () => hits } });
  getGrafanaSearcherMock.mockReturnValue({ search } as unknown as ReturnType<typeof getGrafanaSearcher>);
  return search;
}

describe('getRecentlyViewedDashboards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns dashboards in the order they were opened', async () => {
    getDashboardOpenedMock.mockResolvedValue(['a', 'b', 'c']);
    setupSearcher([hit('c'), hit('a'), hit('b')]);

    const result = await getRecentlyViewedDashboards(5);

    expect(result.map((d) => d.uid)).toEqual(['a', 'b', 'c']);
  });

  it('pushes dashboards missing from the impression list to the end', async () => {
    getDashboardOpenedMock.mockResolvedValue(['a', 'b']);
    setupSearcher([hit('unknown'), hit('b'), hit('a')]);

    const result = await getRecentlyViewedDashboards(5);

    expect(result.map((d) => d.uid)).toEqual(['a', 'b', 'unknown']);
  });

  it('only asks the search backend for maxItems dashboards', async () => {
    getDashboardOpenedMock.mockResolvedValue(['a', 'b', 'c', 'd']);
    const search = setupSearcher([hit('a'), hit('b')]);

    await getRecentlyViewedDashboards(2);

    expect(search).toHaveBeenCalledWith(expect.objectContaining({ uid: ['a', 'b'], limit: 2 }));
  });

  it('caps the results at maxItems when the search backend returns more hits than requested', async () => {
    getDashboardOpenedMock.mockResolvedValue(['a', 'b', 'c']);
    setupSearcher([hit('a'), hit('b'), hit('c'), hit('extra-1'), hit('extra-2')]);

    const result = await getRecentlyViewedDashboards(2);

    // The two most recently opened dashboards survive; unrequested hits are dropped
    expect(result.map((d) => d.uid)).toEqual(['a', 'b']);
  });

  it('does not search when nothing has been opened', async () => {
    getDashboardOpenedMock.mockResolvedValue([]);
    const search = setupSearcher([]);

    expect(await getRecentlyViewedDashboards(5)).toEqual([]);
    expect(search).not.toHaveBeenCalled();
  });

  it('returns no dashboards when the search fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    getDashboardOpenedMock.mockResolvedValue(['a']);
    const search = jest.fn().mockRejectedValue(new Error('search is down'));
    getGrafanaSearcherMock.mockReturnValue({ search } as unknown as ReturnType<typeof getGrafanaSearcher>);

    expect(await getRecentlyViewedDashboards(5)).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load recently viewed dashboards', expect.anything());
    consoleErrorSpy.mockRestore();
  });
});
