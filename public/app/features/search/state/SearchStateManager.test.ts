import { waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';

import { locationService, setBackendSrv } from '@grafana/runtime';
import { getCustomSearchHandler, searchRoute } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

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
