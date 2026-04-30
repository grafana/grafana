import { configureStore } from 'app/store/configureStore';
import { useSelector } from 'app/types/store';

import { fullyLoadedViewItemCollection } from '../fixtures/state.fixtures';
import { type BrowseDashboardsState } from '../types';

import { useBrowseFolderItemCount, useBrowseLoadingStatus } from './hooks';

jest.mock('app/types/store', () => {
  const original = jest.requireActual('app/types/store');
  return {
    ...original,
    useSelector: jest.fn(),
  };
});

function createInitialState(partial: Partial<BrowseDashboardsState>): BrowseDashboardsState {
  return {
    rootItems: undefined,
    childrenByParentUID: {},
    openFolders: {},
    selectedItems: {
      $all: false,
      dashboard: {},
      folder: {},
      panel: {},
    },

    ...partial,
  };
}

describe('browse-dashboards state hooks', () => {
  const folderUID = 'abc-123';

  function mockState(browseState: BrowseDashboardsState) {
    const wholeState = configureStore().getState();
    wholeState.browseDashboards = browseState;

    jest.mocked(useSelector).mockImplementationOnce((callback) => {
      return callback(wholeState);
    });
  }

  describe('useBrowseLoadingStatus', () => {
    it('returns loading when root view is loading', () => {
      mockState(createInitialState({ rootItems: undefined }));

      const status = useBrowseLoadingStatus(undefined);
      expect(status).toEqual('pending');
    });

    it('returns loading when folder view is loading', () => {
      mockState(createInitialState({ childrenByParentUID: {} }));

      const status = useBrowseLoadingStatus(folderUID);
      expect(status).toEqual('pending');
    });

    it('returns fulfilled when root view is finished loading', () => {
      mockState(createInitialState({ rootItems: fullyLoadedViewItemCollection([]) }));

      const status = useBrowseLoadingStatus(undefined);
      expect(status).toEqual('fulfilled');
    });

    it('returns fulfilled when folder view is finished loading', () => {
      mockState(
        createInitialState({
          childrenByParentUID: {
            [folderUID]: fullyLoadedViewItemCollection([]),
          },
        })
      );

      const status = useBrowseLoadingStatus(folderUID);
      expect(status).toEqual('fulfilled');
    });
  });

  describe('useBrowseFolderItemCount', () => {
    it('returns 0 for an unknown folder', () => {
      mockState(createInitialState({ childrenByParentUID: {} }));

      const count = useBrowseFolderItemCount(folderUID);
      expect(count).toBe(0);
    });

    it('returns rootItems.items.length when folderUID is undefined', () => {
      const items = [
        { uid: 'a', kind: 'dashboard' as const, title: 'A' },
        { uid: 'b', kind: 'folder' as const, title: 'B' },
      ];
      mockState(createInitialState({ rootItems: fullyLoadedViewItemCollection(items) }));

      const count = useBrowseFolderItemCount(undefined);
      expect(count).toBe(2);
    });

    it('returns childrenByParentUID[uid].items.length for a known folder', () => {
      const items = [
        { uid: 'd1', kind: 'dashboard' as const, title: 'D1' },
        { uid: 'd2', kind: 'dashboard' as const, title: 'D2' },
        { uid: 'd3', kind: 'dashboard' as const, title: 'D3' },
      ];
      mockState(
        createInitialState({
          childrenByParentUID: {
            [folderUID]: fullyLoadedViewItemCollection(items),
          },
        })
      );

      const count = useBrowseFolderItemCount(folderUID);
      expect(count).toBe(3);
    });

    it('returns 0 when rootItems is undefined', () => {
      mockState(createInitialState({ rootItems: undefined }));

      const count = useBrowseFolderItemCount(undefined);
      expect(count).toBe(0);
    });
  });
});
