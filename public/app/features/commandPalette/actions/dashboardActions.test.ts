import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { type ReactNode, createElement } from 'react';

import { config, setBackendSrv } from '@grafana/runtime';
import { getCustomSearchHandler, getHybridSearchHandler, hybridSearchRoute } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { getTestFeatureFlagClient, setTestFlags } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { type ContextSrv, contextSrv } from 'app/core/services/context_srv';
import impressionSrv from 'app/core/services/impression_srv';
import { ManagerKind } from 'app/features/apiserver/types';

import { getRecentDashboardActions, getSearchResultActions, useSearchResults } from './dashboardActions';

setBackendSrv(backendSrv);
setupMockServer();

describe('dashboardActions', () => {
  const mockContextSrv: jest.MockedObjectDeep<ContextSrv> = jest.mocked(contextSrv);
  const mockRecentDashboardUids = ['my-dashboard-1'];

  beforeEach(() => {
    server.use(
      getCustomSearchHandler([
        {
          resource: 'dashboards',
          name: 'my-dashboard-1',
          title: 'My dashboard 1',
          field: {},
          managedBy: { kind: ManagerKind.Repo },
        },
      ])
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
            sectionId: 'recent-dashboards',
            url: '/d/my-dashboard-1/my-dashboard-1',
            managedBy: 'repo',
          },
        ]);
      });

      it('includes managedBy when present in search results', async () => {
        const results = await getRecentDashboardActions();
        expect(results).toEqual([
          expect.objectContaining({
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
            sectionId: 'dashboards',
            subtitle: 'Dashboards',
            url: '/d/my-dashboard-1/my-dashboard-1',
            managedBy: 'repo',
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
            sectionId: 'dashboards',
            subtitle: 'Dashboards',
            url: '/d/my-dashboard-1/my-dashboard-1',
            managedBy: 'repo',
          },
        ]);
      });

      it('includes managedBy in search result actions when present', async () => {
        const results = await getSearchResultActions('mySearchQuery');
        expect(results).toEqual([
          expect.objectContaining({
            managedBy: ManagerKind.Repo,
          }),
        ]);
      });
    });

    describe('with hybrid search enabled', () => {
      beforeAll(() => {
        mockContextSrv.user.isSignedIn = true;
      });

      beforeEach(() => {
        server.use(
          getCustomSearchHandler([
            {
              resource: 'dashboards',
              name: 'lexical-dashboard-1',
              title: 'Lexical dashboard 1',
              field: {},
            },
            {
              resource: 'folders',
              name: 'my-folder-1',
              title: 'My folder 1',
              field: {},
            },
          ]),
          getHybridSearchHandler([{ name: 'hybrid-dashboard-1', title: 'Hybrid dashboard 1', score: 0.9 }])
        );
      });

      it('returns dashboards from the hybrid endpoint and folders from the classic search', async () => {
        const results = await getSearchResultActions('mySearchQuery', true);
        expect(results).toEqual([
          {
            id: 'go/dashboard/d/hybrid-dashboard-1/hybrid-dashboard-1',
            name: 'Hybrid dashboard 1',
            priority: 1,
            section: 'Dashboards',
            sectionId: 'dashboards',
            subtitle: 'Dashboards',
            url: '/d/hybrid-dashboard-1/hybrid-dashboard-1',
          },
          expect.objectContaining({
            id: 'go/folder/dashboards/f/my-folder-1',
            name: 'My folder 1',
            section: 'Folders',
            sectionId: 'folders',
            url: '/dashboards/f/my-folder-1',
          }),
        ]);
      });

      it('caps hybrid dashboard results at 20', async () => {
        server.use(
          getHybridSearchHandler(Array.from({ length: 30 }, (_, i) => ({ name: `dash-${i}`, title: `Dash ${i}` })))
        );
        const results = await getSearchResultActions('mySearchQuery', true);
        const dashboardResults = results.filter((action) => action.sectionId === 'dashboards');
        expect(dashboardResults).toHaveLength(20);
      });

      it('falls back to the classic search for dashboards when the hybrid endpoint fails', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        server.use(http.get(hybridSearchRoute, () => HttpResponse.json({}, { status: 501 })));

        const results = await getSearchResultActions('mySearchQuery', true);

        expect(results).toEqual([
          expect.objectContaining({
            name: 'Lexical dashboard 1',
            sectionId: 'dashboards',
          }),
          expect.objectContaining({
            name: 'My folder 1',
            sectionId: 'folders',
          }),
        ]);
        expect(consoleErrorSpy).toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
      });
    });
  });

  describe('useSearchResults', () => {
    // The hook evaluates the grafana.cmdkHybridSearch flag, so it needs an OpenFeature provider
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(OpenFeatureProvider, { client: getTestFeatureFlagClient() }, children);

    // Initialize the test flag provider before the first render so the provider's
    // ready event doesn't fire as a state update mid-test
    beforeAll(() => {
      setTestFlags({});
    });

    afterAll(() => {
      setTestFlags({});
    });

    it('returns an empty array if the search query is empty', async () => {
      const { result } = renderHook(
        () => {
          return useSearchResults({ searchQuery: '', show: true });
        },
        { wrapper }
      );
      expect(result.current.searchResults).toEqual([]);
      expect(result.current.isFetchingSearchResults).toEqual(false);
    });

    it('returns an empty array if show is false', async () => {
      const { result } = renderHook(
        () => {
          return useSearchResults({ searchQuery: 'something', show: false });
        },
        { wrapper }
      );
      expect(result.current.searchResults).toEqual([]);
      expect(result.current.isFetchingSearchResults).toBe(false);
    });

    it('returns dashboard actions', async () => {
      mockContextSrv.user.isSignedIn = true;
      const { result } = renderHook(
        () => {
          return useSearchResults({ searchQuery: 'mySearchQuery', show: true });
        },
        { wrapper }
      );
      expect(result.current.isFetchingSearchResults).toBe(true);
      await waitFor(() => {
        expect(result.current.searchResults).toEqual([
          {
            id: 'go/dashboard/d/my-dashboard-1/my-dashboard-1',
            name: 'My dashboard 1',
            priority: 1,
            section: 'Dashboards',
            sectionId: 'dashboards',
            subtitle: 'Dashboards',
            url: '/d/my-dashboard-1/my-dashboard-1',
            managedBy: 'repo',
          },
        ]);
      });
    });

    it('returns hybrid dashboard actions when the grafana.cmdkHybridSearch flag is on', async () => {
      mockContextSrv.user.isSignedIn = true;
      setTestFlags({ 'grafana.cmdkHybridSearch': true });
      server.use(getHybridSearchHandler([{ name: 'hybrid-dashboard-1', title: 'Hybrid dashboard 1', score: 0.9 }]));

      const { result } = renderHook(
        () => {
          return useSearchResults({ searchQuery: 'mySearchQuery', show: true });
        },
        { wrapper }
      );
      await waitFor(() => {
        expect(result.current.searchResults).toEqual([
          {
            id: 'go/dashboard/d/hybrid-dashboard-1/hybrid-dashboard-1',
            name: 'Hybrid dashboard 1',
            priority: 1,
            section: 'Dashboards',
            sectionId: 'dashboards',
            subtitle: 'Dashboards',
            url: '/d/hybrid-dashboard-1/hybrid-dashboard-1',
          },
        ]);
      });
    });
  });
});
