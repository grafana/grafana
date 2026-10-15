import { QueryStatus } from '@reduxjs/toolkit/query';
import { renderHook } from 'test/test-utils';

import { useSelectableFolders } from './useSelectableFolders';

const mockDispatch = jest.fn();
const mockInitiate = jest.fn();
const mockSelect = jest.fn();

jest.mock('app/types/store', () => ({
  ...jest.requireActual('app/types/store'),
  useDispatch: jest.fn(() => mockDispatch),
  // The mocked endpoint selectors ignore the store, so run the real aggregation against an empty state
  useSelector: jest.fn((selector: (state: unknown) => unknown) => selector({})),
}));

jest.mock('app/api/clients/dashboard/v0alpha1', () => ({
  dashboardAPIv0alpha1: {
    endpoints: {
      searchDashboardsAndFolders: {
        initiate: (...args: unknown[]) => mockInitiate(...args),
        select: (...args: unknown[]) => mockSelect(...args),
      },
    },
  },
}));

// Each selector returns the same object every time, as real RTK Query selectors do
const selectorReturning = (result: unknown) => () => result;

const responseFor = (...names: string[]) => ({ data: { hits: names.map((name) => ({ name })) } });

describe('useSelectableFolders', () => {
  const unsubscribe = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockDispatch.mockReturnValue({ unsubscribe });
    mockSelect.mockImplementation((args) => selectorReturning({ status: QueryStatus.pending, originalArgs: args }));
  });

  it('checks the loaded children of each parent', () => {
    renderHook(() => useSelectableFolders({ general: responseFor('a', 'b'), a: responseFor('c') }, true));

    expect(mockInitiate).toHaveBeenCalledTimes(2);
    expect(mockInitiate).toHaveBeenCalledWith({ type: 'folder', permission: 'edit', name: ['a', 'b'], limit: 2 });
    expect(mockInitiate).toHaveBeenCalledWith({ type: 'folder', permission: 'edit', name: ['c'], limit: 1 });
  });

  it('only checks a parent again when its children change', () => {
    const { rerender } = renderHook(({ responses }) => useSelectableFolders(responses, true), {
      initialProps: { responses: { general: responseFor('a') } },
    });

    rerender({ responses: { general: responseFor('a') } });
    expect(mockInitiate).toHaveBeenCalledTimes(1);

    rerender({ responses: { general: responseFor('a', 'b') } });
    expect(mockInitiate).toHaveBeenCalledTimes(2);
    expect(mockInitiate).toHaveBeenLastCalledWith({ type: 'folder', permission: 'edit', name: ['a', 'b'], limit: 2 });
  });

  it('does not check anything when disabled or when a parent has no children', () => {
    renderHook(() => useSelectableFolders({ general: responseFor('a'), empty: responseFor() }, false));
    renderHook(() => useSelectableFolders({ empty: responseFor() }, true));

    expect(mockInitiate).not.toHaveBeenCalled();
  });

  it('treats every folder as read only when the check fails', () => {
    mockSelect.mockImplementation(() =>
      selectorReturning({ status: QueryStatus.rejected, error: new Error('Forbidden') })
    );

    const { result } = renderHook(() => useSelectableFolders({ general: responseFor('a') }, true));

    expect(result.current.selectableByParent.general).toEqual(new Set());
    expect(result.current.error).toEqual(new Error('Forbidden'));
  });

  it('unsubscribes from its checks on unmount', () => {
    const { unmount } = renderHook(() => useSelectableFolders({ general: responseFor('a') }, true));

    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
