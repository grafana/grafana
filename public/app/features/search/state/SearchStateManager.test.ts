import { waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';

import { store } from '@grafana/data';
import { locationService, setBackendSrv } from '@grafana/runtime';
import { getCustomSearchHandler, searchRoute } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { TrashStateManager } from 'app/features/browse-dashboards/api/useRecentlyDeletedStateManager';

import { SEARCH_SELECTED_LAYOUT, SEARCH_SELECTED_LAYOUT_DELETED, SEARCH_SELECTED_SORT } from '../constants';
import { SearchLayout } from '../types';
import * as utils from '../utils';

import { initialState, SearchStateManager } from './SearchStateManager';

jest.mock('lodash', () => {
  const orig = jest.requireActual('lodash');

  return {
    ...orig,
    debounce: (d: Function) => d,
  };
});

jest.mock('@grafana/runtime', () => {
  const originalModule = jest.requireActual('@grafana/runtime');
  return {
    ...originalModule,
  };
});

setBackendSrv(backendSrv);
setupMockServer();

const createSearchStateManager = () => new SearchStateManager({ ...initialState, includePanels: false });

describe('SearchStateManager', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    server.use(getCustomSearchHandler([]));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('Can get search state manager with initial state', async () => {
    const stm = createSearchStateManager();
    expect(stm.state.layout).toBe(SearchLayout.Folders);
  });

  describe('initStateFromUrl', () => {
    it('should read and set state from URL and trigger search', async () => {
      const stm = createSearchStateManager();
      locationService.partial({ query: 'test', tag: ['tag1', 'tag2'] });
      stm.initStateFromUrl();
      expect(stm.state.folderUid).toBe(undefined);
      expect(stm.state.query).toBe('test');
      expect(stm.state.tag).toEqual(['tag1', 'tag2']);
    });

    it('should init or clear folderUid', async () => {
      const stm = createSearchStateManager();
      stm.initStateFromUrl('asdsadas');
      expect(stm.state.folderUid).toBe('asdsadas');

      stm.initStateFromUrl();
      expect(stm.state.folderUid).toBe(undefined);
    });

    it('should reset filters if state is updated and no URL params are present', () => {
      const parseRouteParamsSpy = jest.spyOn(utils, 'parseRouteParams');
      // Set initial values
      parseRouteParamsSpy.mockImplementation(() => ({
        query: 'hello',
        sort: 'alpha-asc',
      }));
      const stm = createSearchStateManager();
      // Set list layout since folders layout implies sort to be undefined
      stm.onLayoutChange(SearchLayout.List);
      stm.initStateFromUrl();

      // Verify that they have been set
      expect(stm.state.query).toBe('hello');
      expect(stm.state.sort).toBe('alpha-asc');
      expect(stm.state.folderUid).toBe(undefined);

      // Changed to a view with no URL state.
      parseRouteParamsSpy.mockImplementation(() => ({}));
      stm.initStateFromUrl('abc');

      expect(stm.state.query).toBe('');
      expect(stm.state.sort).toBe(undefined);
      expect(stm.state.folderUid).toBe('abc');
    });

    it('reads persisted layout from the main SEARCH_SELECTED_LAYOUT key', () => {
      store.set(SEARCH_SELECTED_LAYOUT, SearchLayout.List);
      store.set(SEARCH_SELECTED_SORT, 'name_sort');
      const stm = createSearchStateManager();
      stm.initStateFromUrl(undefined, false);
      expect(stm.state.layout).toBe(SearchLayout.List);
      expect(stm.state.sort).toBe('name_sort');
      expect(stm.state.prevSort).toBe('name_sort');
    });

    describe('stale recently-deleted sort guard', () => {
      beforeEach(() => {
        localStorage.clear();
      });

      it('clears a recently-deleted sort value from the main key and ignores it', () => {
        store.set(SEARCH_SELECTED_SORT, 'deleted-desc');
        const stm = createSearchStateManager();
        stm.initStateFromUrl(undefined, false);

        expect(stm.state.prevSort).toBeUndefined();
        expect(store.get(SEARCH_SELECTED_SORT)).toBeUndefined();
      });

      it('clears all recently-deleted vocabulary values from the main key', () => {
        const recentlyDeletedValues = [
          'alpha-asc',
          'alpha-desc',
          'deleted-asc',
          'deleted-desc',
          'deletedby-asc',
          'deletedby-desc',
        ];
        for (const value of recentlyDeletedValues) {
          store.set(SEARCH_SELECTED_SORT, value);
          const stm = createSearchStateManager();
          stm.initStateFromUrl(undefined, false);

          expect(stm.state.prevSort).toBeUndefined();
          expect(store.get(SEARCH_SELECTED_SORT)).toBeUndefined();
        }
      });

      it('preserves valid main-page sort values', () => {
        store.set(SEARCH_SELECTED_SORT, 'name_sort');
        const stm = createSearchStateManager();
        store.set('grafana.search.layout', 'list');
        stm.initStateFromUrl(undefined, false);

        expect(stm.state.prevSort).toBe('name_sort');
        expect(store.get(SEARCH_SELECTED_SORT)).toBe('name_sort');
      });

      it('preserves -name_sort as a valid main-page value', () => {
        store.set(SEARCH_SELECTED_SORT, '-name_sort');
        const stm = createSearchStateManager();
        store.set('grafana.search.layout', 'list');
        stm.initStateFromUrl(undefined, false);

        expect(stm.state.prevSort).toBe('-name_sort');
        expect(store.get(SEARCH_SELECTED_SORT)).toBe('-name_sort');
      });
    });

    describe('main layout not affected by TrashStateManager sort', () => {
      beforeEach(() => {
        localStorage.clear();
      });

      it('leaves main layout key unchanged when trash page picks a sort', () => {
        localStorage.setItem(SEARCH_SELECTED_LAYOUT, SearchLayout.Folders);
        const stm = new TrashStateManager({ ...initialState, includePanels: false, deleted: true });
        jest.spyOn(stm, 'doSearch').mockResolvedValue(undefined);
        stm.onSortChange('deleted-desc');

        expect(localStorage.getItem(SEARCH_SELECTED_LAYOUT)).toBe(SearchLayout.Folders);
        expect(localStorage.getItem(SEARCH_SELECTED_LAYOUT_DELETED)).toBe(SearchLayout.List);
      });
    });

    it('updates search results in order', async () => {
      jest.useRealTimers();
      const stm = createSearchStateManager();

      server.use(
        http.get(searchRoute, async ({ request }) => {
          const url = new URL(request.url);
          const query = url.searchParams.get('query');
          const typeFilters = url.searchParams.getAll('type');

          if (typeFilters.includes('folder') && query === null) {
            return HttpResponse.json({ totalHits: 0, hits: [] });
          }

          if (query === 'd') {
            await delay(100);
            return HttpResponse.json({
              totalHits: 100,
              hits: [{ resource: 'dashboards', name: 'dash-d', title: 'Dash D', field: {} }],
            });
          }

          if (query === 'debugging') {
            await delay(50);
            return HttpResponse.json({
              totalHits: 10,
              hits: [{ resource: 'dashboards', name: 'dash-debugging', title: 'Dash Debugging', field: {} }],
            });
          }

          return HttpResponse.json({ totalHits: 0, hits: [] });
        })
      );

      stm.onQueryChange('d');
      stm.onQueryChange('debugging');

      await waitFor(() => expect(stm.state.result?.totalRows).toEqual(10));
    });
  });
});
