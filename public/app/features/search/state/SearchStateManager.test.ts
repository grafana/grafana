import { waitFor } from '@testing-library/react';

import { locationService, setBackendSrv } from '@grafana/runtime';
import { getCustomSearchHandler } from '@grafana/test-utils/handlers';
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
      const stm = createSearchStateManager();
      let now = 0;
      jest.spyOn(Date, 'now').mockImplementation(() => ++now);
      jest.spyOn(backendSrv, 'get').mockImplementation((url) => {
        const requestUrl = typeof url === 'string' ? url : '';
        const parsedUrl = new URL(requestUrl, 'http://localhost');
        const query = parsedUrl.searchParams.get('query');
        const typeFilters = parsedUrl.searchParams.getAll('type');

        if (typeFilters.includes('folder') && query === null) {
          return Promise.resolve({ totalHits: 0, hits: [] });
        }

        if (query === 'd') {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                totalHits: 100,
                hits: [{ resource: 'dashboard', name: 'dash-d', title: 'Dash D', field: {} }],
              });
            }, 100);
          });
        }

        if (query === 'debugging') {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                totalHits: 10,
                hits: [{ resource: 'dashboard', name: 'dash-debugging', title: 'Dash Debugging', field: {} }],
              });
            }, 50);
          });
        }

        return Promise.resolve({ totalHits: 0, hits: [] });
      });

      stm.onQueryChange('d');
      stm.onQueryChange('debugging');

      jest.advanceTimersByTime(150);
      jest.runOnlyPendingTimers();
      await Promise.resolve();

      await waitFor(() => expect(stm.state.result?.totalRows).toEqual(10));
    });
  });
});
