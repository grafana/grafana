import { renderHook, waitFor } from '@testing-library/react';

import { type DataFrame, DataFrameView, FieldType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { type ContextSrv, contextSrv } from 'app/core/services/context_srv';
import impressionSrv from 'app/core/services/impression_srv';
import { ManagerKind } from 'app/features/apiserver/types';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { type DashboardQueryResult, type QueryResponse } from 'app/features/search/service/types';

import { getRecentDashboardActions, getSearchResultActions, useSearchResults } from './dashboardActions';

setBackendSrv(backendSrv);
setupMockServer();

// const searchRoute = '/apis/dashboard.grafana.app/v0alpha1/namespaces/:namespace/search';

describe('dashboardActions', () => {
  const mockContextSrv: jest.MockedObjectDeep<ContextSrv> = jest.mocked(contextSrv);
  const mockRecentDashboardUids = ['my-dashboard-1'];

  beforeEach(() => {
    server.use(
      getCustomSearchHandler([{ resource: 'dashboards', name: 'my-dashboard-1', title: 'My dashboard 1', field: {} }])
    );
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
        expect(results).toEqual([
          {
            id: 'recent-dashboards/d/my-dashboard-1/my-dashboard-1',
            name: 'My dashboard 1',
            priority: 6,
            section: 'Recent dashboards',
            url: '/d/my-dashboard-1/my-dashboard-1',
          },
        ]);
      });

      it('includes managedBy when present in search results', async () => {
        const searchDataWithManagedBy: DataFrame = {
          ...searchData,
          fields: [
            ...searchData.fields,
            { name: 'managedBy', type: FieldType.string, config: {}, values: [ManagerKind.Repo] },
          ],
        };
        grafanaSearcherSpy.mockResolvedValueOnce({
          ...mockSearchResult,
          view: new DataFrameView<DashboardQueryResult>(searchDataWithManagedBy),
        });

        const results = await getRecentDashboardActions();
        expect(results).toEqual([
          expect.objectContaining({
            id: 'recent-dashboards/my-dashboard-1',
            managedBy: ManagerKind.Repo,
          }),
        ]);
      });
    });
  });

  describe('getSearchResultActions', () => {
    it('returns an empty array if the search query is empty', async () => {
      const searchQuery = '';
      const results = await getSearchResultActions(searchQuery);
      expect(results).toEqual([]);
    });

    describe('when not signed in', () => {
      beforeAll(() => {
        mockContextSrv.user.isSignedIn = false;
      });

      it('returns an empty array if anonymous access is not enabled', async () => {
        config.anonymousEnabled = false;
        const searchQuery = 'mySearchQuery';
        const results = await getSearchResultActions(searchQuery);
        expect(results).toEqual([]);
      });

      it('calls the search backend and returns an array of CommandPaletteActions if anonymous access is enabled', async () => {
        config.anonymousEnabled = true;
        const searchQuery = 'mySearchQuery';
        const results = await getSearchResultActions(searchQuery);
        expect(results).toEqual([
          {
            id: 'go/dashboard/d/my-dashboard-1/my-dashboard-1',
            name: 'My dashboard 1',
            priority: 1,
            section: 'Dashboards',
            subtitle: 'Dashboards',
            url: '/d/my-dashboard-1/my-dashboard-1',
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
        expect(results).toEqual([
          {
            id: 'go/dashboard/d/my-dashboard-1/my-dashboard-1',
            name: 'My dashboard 1',
            priority: 1,
            section: 'Dashboards',
            subtitle: 'Dashboards',
            url: '/d/my-dashboard-1/my-dashboard-1',
          },
        ]);
      });

      it('includes managedBy in search result actions when present', async () => {
        const searchDataWithManagedBy: DataFrame = {
          ...searchData,
          fields: [
            ...searchData.fields,
            { name: 'managedBy', type: FieldType.string, config: {}, values: [ManagerKind.Repo] },
          ],
        };
        grafanaSearcherSpy.mockResolvedValueOnce({
          ...mockSearchResult,
          view: new DataFrameView<DashboardQueryResult>(searchDataWithManagedBy),
        });

        const results = await getSearchResultActions('mySearchQuery');
        expect(results).toEqual([
          expect.objectContaining({
            id: 'go/dashboard/my-dashboard-1',
            managedBy: ManagerKind.Repo,
          }),
        ]);
      });
    });
  });

  describe('useSearchResults', () => {
    it('returns an empty array if the search query is empty', async () => {
      const { result } = renderHook(() => {
        return useSearchResults({ searchQuery: '', show: true });
      });
      expect(result.current.searchResults).toEqual([]);
      expect(result.current.isFetchingSearchResults).toEqual(false);
    });

    it('returns an empty array if show is false', async () => {
      const { result } = renderHook(() => {
        return useSearchResults({ searchQuery: 'something', show: false });
      });
      expect(result.current.searchResults).toEqual([]);
      expect(result.current.isFetchingSearchResults).toBe(false);
    });

    it('returns dashboard actions', async () => {
      mockContextSrv.user.isSignedIn = true;
      const { result } = renderHook(() => {
        return useSearchResults({ searchQuery: 'mySearchQuery', show: true });
      });
      expect(result.current.isFetchingSearchResults).toBe(true);
      await waitFor(() => {
        expect(result.current.searchResults).toEqual([
          {
            id: 'go/dashboard/d/my-dashboard-1/my-dashboard-1',
            name: 'My dashboard 1',
            priority: 1,
            section: 'Dashboards',
            subtitle: 'Dashboards',
            url: '/d/my-dashboard-1/my-dashboard-1',
          },
        ]);
      });
    });
  });
});
