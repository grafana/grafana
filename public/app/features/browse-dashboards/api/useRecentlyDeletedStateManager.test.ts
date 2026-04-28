import { store } from '@grafana/data';
import { setBackendSrv } from '@grafana/runtime';
import { getCustomSearchHandler } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import {
  SEARCH_SELECTED_LAYOUT,
  SEARCH_SELECTED_LAYOUT_DELETED,
  SEARCH_SELECTED_SORT,
  SEARCH_SELECTED_SORT_DELETED,
} from 'app/features/search/constants';
import { SearchLayout } from 'app/features/search/types';

import { initialState } from '../../search/state/SearchStateManager';

import { TrashStateManager } from './useRecentlyDeletedStateManager';

jest.mock('lodash', () => {
  const orig = jest.requireActual('lodash');
  return { ...orig, debounce: (fn: Function) => fn };
});

jest.mock('@grafana/runtime', () => {
  const orig = jest.requireActual('@grafana/runtime');
  return {
    ...orig,
    locationService: {
      partial: jest.fn(),
      getSearchObject: () => ({}),
      getSearch: () => new URLSearchParams(),
    },
  };
});

setBackendSrv(backendSrv);
setupMockServer();

const createTrashStateManager = () => new TrashStateManager({ ...initialState, includePanels: false, deleted: true });

describe('TrashStateManager', () => {
  beforeEach(() => {
    localStorage.clear();
    server.use(getCustomSearchHandler([]));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('onSortChange', () => {
    it('writes to the recently-deleted key, not the main sort key', () => {
      const stm = createTrashStateManager();
      jest.spyOn(stm, 'doSearch').mockResolvedValue(undefined);
      stm.onSortChange('deleted-desc');

      expect(store.get(SEARCH_SELECTED_SORT_DELETED)).toBe('deleted-desc');
      expect(store.get(SEARCH_SELECTED_SORT)).toBeUndefined();
      expect(localStorage.getItem(SEARCH_SELECTED_LAYOUT_DELETED)).toBe(SearchLayout.List);
      expect(localStorage.getItem(SEARCH_SELECTED_LAYOUT)).toBeNull();
    });

    it('does not overwrite the main dashboard layout key', () => {
      localStorage.setItem(SEARCH_SELECTED_LAYOUT, SearchLayout.Folders);
      const stm = createTrashStateManager();
      jest.spyOn(stm, 'doSearch').mockResolvedValue(undefined);
      stm.onSortChange('alpha-asc');

      expect(localStorage.getItem(SEARCH_SELECTED_LAYOUT)).toBe(SearchLayout.Folders);
      expect(localStorage.getItem(SEARCH_SELECTED_LAYOUT_DELETED)).toBe(SearchLayout.List);
    });

    it('removes the recently-deleted key when sort is cleared', () => {
      const stm = createTrashStateManager();
      jest.spyOn(stm, 'doSearch').mockResolvedValue(undefined);
      store.set(SEARCH_SELECTED_SORT_DELETED, 'deleted-desc');
      stm.onSortChange(undefined);

      expect(store.get(SEARCH_SELECTED_SORT_DELETED)).toBeUndefined();
      expect(store.get(SEARCH_SELECTED_SORT)).toBeUndefined();
    });
  });

  describe('initStateFromUrl', () => {
    it('reads sort back from the recently-deleted key', () => {
      store.set(SEARCH_SELECTED_SORT_DELETED, 'alpha-asc');

      const stm = createTrashStateManager();
      stm.initStateFromUrl(undefined, false);

      expect(stm.state.prevSort).toBe('alpha-asc');
    });

    it('does not read from the main sort key', () => {
      store.set(SEARCH_SELECTED_SORT, 'name_sort');
      store.delete(SEARCH_SELECTED_SORT_DELETED);

      const stm = createTrashStateManager();
      stm.initStateFromUrl(undefined, false);

      expect(stm.state.prevSort).toBeUndefined();
    });
  });
});
