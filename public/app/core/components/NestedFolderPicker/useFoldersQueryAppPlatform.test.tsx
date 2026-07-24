import { act, renderHook } from 'test/test-utils';

import { dashboardAPIv0alpha1 } from 'app/api/clients/dashboard/v0alpha1';
import { useDispatch, useSelector } from 'app/types/store';

import { useFoldersQueryAppPlatform } from './useFoldersQueryAppPlatform';

jest.mock('app/types/store', () => ({
  ...jest.requireActual('app/types/store'),
  useDispatch: jest.fn(),
  useSelector: jest.fn(),
}));

jest.mock('app/api/clients/dashboard/v0alpha1', () => ({
  dashboardAPIv0alpha1: {
    endpoints: {
      searchDashboardsAndFolders: {
        initiate: jest.fn(),
        select: jest.fn(),
      },
    },
  },
}));

describe('useFoldersQueryAppPlatform', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns a list that contains the virtual "Shared with me" folder under the root', () => {
    (useDispatch as jest.Mock).mockReturnValue(jest.fn());
    (useSelector as jest.Mock).mockImplementation(() => ({
      isLoading: false,
      responseByParent: {},
    }));

    const { result } = renderHook(() =>
      useFoldersQueryAppPlatform({
        isBrowsing: true,
        openFolders: {},
        permission: 'edit',
      })
    );

    // Root "Dashboards" item is injected by the hook.
    expect(result.current.items[0].item.kind).toBe('folder');
    expect(result.current.items[0].item.uid).toBe('');

    const sharedWithMe = result.current.items.find((t) => t.item.kind === 'folder' && t.item.uid === 'sharedwithme');
    expect(sharedWithMe).toBeDefined();
    expect(sharedWithMe?.level).toBe(1);
  });

  it('dispatches an app-platform search request when requestNextPage is called', () => {
    const unsubscribe = jest.fn();
    const subscription = { unsubscribe };
    const dispatch = jest.fn(() => subscription);

    (useDispatch as jest.Mock).mockReturnValue(dispatch);
    (useSelector as jest.Mock).mockImplementation(() => ({
      isLoading: false,
      responseByParent: {},
    }));

    const initiateMock = dashboardAPIv0alpha1.endpoints.searchDashboardsAndFolders.initiate as jest.Mock;
    const selectMock = dashboardAPIv0alpha1.endpoints.searchDashboardsAndFolders.select as jest.Mock;
    initiateMock.mockReturnValue(subscription);
    selectMock.mockReturnValue(jest.fn());

    const { result } = renderHook(() =>
      useFoldersQueryAppPlatform({
        isBrowsing: true,
        openFolders: {},
        permission: 'edit',
      })
    );

    act(() => {
      result.current.requestNextPage(undefined);
    });

    expect(initiateMock).toHaveBeenCalledWith({ folder: 'general', type: 'folder', permission: 'edit' });
    expect(dispatch).toHaveBeenCalledWith(subscription);
    expect(selectMock).toHaveBeenCalledWith({ folder: 'general', type: 'folder', permission: 'edit' });
  });
});
