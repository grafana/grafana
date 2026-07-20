import { renderHook } from '@testing-library/react';
import { shallowEqual } from 'react-redux';

import { scopeAPIv0alpha1 } from 'app/api/clients/scope/v0alpha1';
import { useDispatch, useSelector } from 'app/types/store';

import { useScopeNodesByName, useScopesById } from './useScopesApi';

const mockSelectResult = jest.fn();

jest.mock('app/api/clients/scope/v0alpha1', () => ({
  scopeAPIv0alpha1: {
    endpoints: {
      getScope: {
        initiate: jest.fn(() => ({ unsubscribe: jest.fn() })),
        select: jest.fn(() => mockSelectResult),
      },
      getScopeNode: {
        initiate: jest.fn(() => ({ unsubscribe: jest.fn() })),
        select: jest.fn(() => mockSelectResult),
      },
    },
  },
}));

jest.mock('app/types/store', () => ({
  ...jest.requireActual('app/types/store'),
  useDispatch: jest.fn(),
  useSelector: jest.fn(),
}));

const mockUseDispatch = jest.mocked(useDispatch);
const mockUseSelector = jest.mocked(useSelector);

describe('useScopesById', () => {
  let mockDispatch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDispatch = jest.fn((action) => action);
    mockUseDispatch.mockReturnValue(mockDispatch);
    mockUseSelector.mockReturnValue({});
    mockSelectResult.mockReturnValue({ data: undefined });
  });

  it('returns empty record when names is empty', () => {
    const { result } = renderHook(() => useScopesById([]));
    expect(result.current).toEqual({});
  });

  it('dispatches initiate for each name on mount', () => {
    renderHook(() => useScopesById(['scope-a', 'scope-b']));
    expect(scopeAPIv0alpha1.endpoints.getScope.initiate).toHaveBeenCalledWith({ name: 'scope-a' });
    expect(scopeAPIv0alpha1.endpoints.getScope.initiate).toHaveBeenCalledWith({ name: 'scope-b' });
  });

  it('does not dispatch when names is empty', () => {
    renderHook(() => useScopesById([]));
    expect(scopeAPIv0alpha1.endpoints.getScope.initiate).not.toHaveBeenCalled();
  });

  it('passes shallowEqual as the comparison function to useSelector', () => {
    renderHook(() => useScopesById(['scope-a']));
    expect(mockUseSelector).toHaveBeenCalledWith(expect.any(Function), shallowEqual);
  });

  it('passes a stable selector reference when names set does not change', () => {
    const { rerender } = renderHook(() => useScopesById(['scope-a']));
    const selectorOnFirstRender = mockUseSelector.mock.calls[0][0];

    rerender();

    const selectorOnSecondRender = mockUseSelector.mock.calls[1][0];
    expect(selectorOnFirstRender).toBe(selectorOnSecondRender);
  });

  it('recreates selector when the names set changes', () => {
    let names = ['scope-a'];
    const { rerender } = renderHook(() => useScopesById(names));
    const selectorBefore = mockUseSelector.mock.calls[0][0];

    names = ['scope-a', 'scope-b'];
    rerender();

    const selectorAfter = mockUseSelector.mock.calls[mockUseSelector.mock.calls.length - 1][0];
    expect(selectorBefore).not.toBe(selectorAfter);
  });

  it('unsubscribes on unmount', () => {
    const mockUnsubscribe = jest.fn();
    jest.mocked(scopeAPIv0alpha1.endpoints.getScope.initiate).mockReturnValue({
      unsubscribe: mockUnsubscribe,
    } as unknown as ReturnType<typeof scopeAPIv0alpha1.endpoints.getScope.initiate>);

    const { unmount } = renderHook(() => useScopesById(['scope-a']));
    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('unsubscribes and resubscribes when names set changes', () => {
    const firstUnsubscribe = jest.fn();
    const secondUnsubscribe = jest.fn();

    jest
      .mocked(scopeAPIv0alpha1.endpoints.getScope.initiate)
      .mockReturnValueOnce({ unsubscribe: firstUnsubscribe } as unknown as ReturnType<
        typeof scopeAPIv0alpha1.endpoints.getScope.initiate
      >)
      .mockReturnValue({ unsubscribe: secondUnsubscribe } as unknown as ReturnType<
        typeof scopeAPIv0alpha1.endpoints.getScope.initiate
      >);

    let names = ['scope-a'];
    const { rerender } = renderHook(() => useScopesById(names));

    names = ['scope-b'];
    rerender();

    expect(firstUnsubscribe).toHaveBeenCalled();
    expect(scopeAPIv0alpha1.endpoints.getScope.initiate).toHaveBeenCalledWith({ name: 'scope-b' });
  });
});

describe('useScopeNodesByName', () => {
  let mockDispatch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDispatch = jest.fn((action) => action);
    mockUseDispatch.mockReturnValue(mockDispatch);
    mockUseSelector.mockReturnValue({});
    mockSelectResult.mockReturnValue({ data: undefined });
  });

  it('returns empty record when names is empty', () => {
    const { result } = renderHook(() => useScopeNodesByName([]));
    expect(result.current).toEqual({});
  });

  it('dispatches initiate for each name on mount', () => {
    renderHook(() => useScopeNodesByName(['node-a', 'node-b']));
    expect(scopeAPIv0alpha1.endpoints.getScopeNode.initiate).toHaveBeenCalledWith({ name: 'node-a' });
    expect(scopeAPIv0alpha1.endpoints.getScopeNode.initiate).toHaveBeenCalledWith({ name: 'node-b' });
  });

  it('passes shallowEqual as the comparison function to useSelector', () => {
    renderHook(() => useScopeNodesByName(['node-a']));
    expect(mockUseSelector).toHaveBeenCalledWith(expect.any(Function), shallowEqual);
  });

  it('passes a stable selector reference when names set does not change', () => {
    const { rerender } = renderHook(() => useScopeNodesByName(['node-a']));
    const selectorOnFirstRender = mockUseSelector.mock.calls[0][0];

    rerender();

    const selectorOnSecondRender = mockUseSelector.mock.calls[1][0];
    expect(selectorOnFirstRender).toBe(selectorOnSecondRender);
  });
});
