import { renderHook } from '@testing-library/react';

import { resourceKindInfos } from '../utils/resourceKinds';

import { useProvisionedResourceDrawerHandlers } from './useProvisionedResourceDrawerHandlers';

const mockNavigate = jest.fn();
const mockDispatch = jest.fn();

jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useNavigate: () => mockNavigate,
}));

jest.mock('app/types/store', () => ({
  ...jest.requireActual('app/types/store'),
  useDispatch: () => mockDispatch,
}));

describe('useProvisionedResourceDrawerHandlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('navigates to the kind’s collection page', () => {
    const { result } = renderHook(() => useProvisionedResourceDrawerHandlers(resourceKindInfos.playlist));

    result.current.goToList();

    expect(mockNavigate).toHaveBeenCalledWith('/playlists');
  });

  it('invalidates the list cache of a kind committed through the shared drawer', () => {
    // Playlist list pages are fetched through their RTK client, so a commit has to invalidate them;
    // dashboards and folders save through their own forms and carry no invalidation.
    const { result } = renderHook(() => useProvisionedResourceDrawerHandlers(resourceKindInfos.playlist));

    result.current.goToList();

    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ type: expect.any(String) }));
  });

  it('dispatches nothing for a kind without a list cache to invalidate', () => {
    const { result } = renderHook(() => useProvisionedResourceDrawerHandlers(resourceKindInfos.dashboard));

    result.current.goToList();

    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/dashboards');
  });
});
