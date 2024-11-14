import { configureStore } from 'app/store/configureStore';
import { useSelector } from 'app/types';

import { fullyLoadedViewItemCollection } from '../fixtures/state.fixtures';
import { BrowseDashboardsState } from '../types';

import { useBrowseLoadingStatus } from './hooks';

jest.mock('app/types', () => {
  const original = jest.requireActual('app/types');
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
});
