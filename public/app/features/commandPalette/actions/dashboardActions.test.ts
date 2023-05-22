import { ArrayVector, DataFrame, DataFrameView, FieldType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { ContextSrv, contextSrv } from 'app/core/services/context_srv';
import impressionSrv from 'app/core/services/impression_srv';
import { DashboardQueryResult, getGrafanaSearcher, QueryResponse } from 'app/features/search/service';

import { getRecentDashboardActions, getSearchResultActions } from './dashboardActions';

describe('dashboardActions', () => {
  let grafanaSearcherSpy: jest.SpyInstance;
  let mockContextSrv: jest.MockedObjectDeep<ContextSrv>;
  const mockRecentDashboardUids = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  const searchData: DataFrame = {
    fields: [
      { name: 'kind', type: FieldType.string, config: {}, values: new ArrayVector(['dashboard']) },
      { name: 'name', type: FieldType.string, config: {}, values: new ArrayVector(['My dashboard 1']) },
      { name: 'uid', type: FieldType.string, config: {}, values: new ArrayVector(['my-dashboard-1']) },
      { name: 'url', type: FieldType.string, config: {}, values: new ArrayVector(['/my-dashboard-1']) },
      { name: 'tags', type: FieldType.other, config: {}, values: new ArrayVector([['foo', 'bar']]) },
      { name: 'location', type: FieldType.string, config: {}, values: new ArrayVector(['my-folder-1']) },
    ],
    meta: {
      custom: {
        locationInfo: {
          'my-folder-1': {
            name: 'My folder 1',
            kind: 'folder',
            url: '/my-folder-1',
          },
        },
      },
    },
    length: 1,
  };

  const mockSearchResult: QueryResponse = {
    isItemLoaded: jest.fn(),
    loadMoreItems: jest.fn(),
    totalRows: searchData.length,
    view: new DataFrameView<DashboardQueryResult>(searchData),
  };

  beforeAll(() => {
    mockContextSrv = jest.mocked(contextSrv);
    grafanaSearcherSpy = jest.spyOn(getGrafanaSearcher(), 'search').mockResolvedValue(mockSearchResult);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getRecentDashboardActions', () => {
    let impressionSrvSpy: jest.SpyInstance;

    beforeAll(() => {
      impressionSrvSpy = jest.spyOn(impressionSrv, 'getDashboardOpened').mockResolvedValue(mockRecentDashboardUids);
    });

    describe('when not signed in', () => {
      beforeAll(() => {
        mockContextSrv.user.isSignedIn = false;
      });

      it('returns an empty array, does not call the impressionSrv and does not call the search backend', async () => {
        const results = await getRecentDashboardActions();
        expect(impressionSrvSpy).not.toHaveBeenCalled();
        expect(grafanaSearcherSpy).not.toHaveBeenCalled();
        expect(results).toEqual([]);
      });
    });

    describe('when signed in', () => {
      beforeAll(() => {
        mockContextSrv.user.isSignedIn = true;
      });

      it('calls the search backend with recent dashboards and returns an array of CommandPaletteActions', async () => {
        const results = await getRecentDashboardActions();
        expect(impressionSrvSpy).toHaveBeenCalled();
        expect(grafanaSearcherSpy).toHaveBeenCalledWith({
          kind: ['dashboard'],
          limit: 5,
          uid: ['1', '2', '3', '4', '5'],
        });
        expect(results).toEqual([
          {
            id: 'recent-dashboards/my-dashboard-1',
            name: 'My dashboard 1',
            priority: 5,
            section: 'Recent dashboards',
            url: '/my-dashboard-1',
          },
        ]);
      });
    });
  });

  describe('getSearchResultActions', () => {
    it('returns an empty array if the search query is empty', async () => {
      const searchQuery = '';
      const results = await getSearchResultActions(searchQuery);
      expect(grafanaSearcherSpy).not.toHaveBeenCalled();
      expect(results).toEqual([]);
    });

    describe('when not signed in', () => {
      beforeAll(() => {
        mockContextSrv.user.isSignedIn = false;
      });

      it('returns an empty array if anonymous access is not enabled', async () => {
        config.bootData.settings.anonymousEnabled = false;
        const searchQuery = 'mySearchQuery';
        const results = await getSearchResultActions(searchQuery);
        expect(grafanaSearcherSpy).not.toHaveBeenCalled();
        expect(results).toEqual([]);
      });

      it('calls the search backend and returns an array of CommandPaletteActions if anonymous access is enabled', async () => {
        config.bootData.settings.anonymousEnabled = true;
        const searchQuery = 'mySearchQuery';
        const results = await getSearchResultActions(searchQuery);
        expect(grafanaSearcherSpy).toHaveBeenCalledWith({
          kind: ['dashboard', 'folder'],
          query: searchQuery,
          limit: 100,
        });
        expect(results).toEqual([
          {
            id: 'go/dashboard/my-dashboard-1',
            name: 'My dashboard 1',
            priority: 1,
            section: 'Dashboards',
            subtitle: 'My folder 1',
            url: '/my-dashboard-1',
          },
        ]);
      });
    });

    describe('when signed in', () => {
      beforeAll(() => {
        mockContextSrv.user.isSignedIn = true;
      });

      it('calls the search backend with recent dashboards and returns an array of CommandPaletteActions', async () => {
        const searchQuery = 'mySearchQuery';
        const results = await getSearchResultActions(searchQuery);
        expect(grafanaSearcherSpy).toHaveBeenCalledWith({
          kind: ['dashboard', 'folder'],
          query: searchQuery,
          limit: 100,
        });
        expect(results).toEqual([
          {
            id: 'go/dashboard/my-dashboard-1',
            name: 'My dashboard 1',
            priority: 1,
            section: 'Dashboards',
            subtitle: 'My folder 1',
            url: '/my-dashboard-1',
          },
        ]);
      });
    });
  });
});
