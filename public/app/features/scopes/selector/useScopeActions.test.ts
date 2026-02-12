import { renderHook } from '@testing-library/react';

import { useScopeActions } from './useScopeActions';

// Mock the ScopesContextProvider hook
jest.mock('../ScopesContextProvider', () => ({
  useScopesServices: jest.fn(),
}));

const { useScopesServices } = jest.requireMock('../ScopesContextProvider');

describe('useScopeActions', () => {
  const mockSelectScope = jest.fn();
  const mockDeselectScope = jest.fn();
  const mockFilterNode = jest.fn();
  const mockToggleExpandedNode = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return action methods from scopesSelectorService', () => {
    useScopesServices.mockReturnValue({
      scopesSelectorService: {
        selectScope: mockSelectScope,
        deselectScope: mockDeselectScope,
        filterNode: mockFilterNode,
        toggleExpandedNode: mockToggleExpandedNode,
      },
    });

    const { result } = renderHook(() => useScopeActions());

    expect(result.current.selectScope).toBe(mockSelectScope);
    expect(result.current.deselectScope).toBe(mockDeselectScope);
    expect(result.current.filterNode).toBe(mockFilterNode);
    expect(result.current.toggleExpandedNode).toBe(mockToggleExpandedNode);
  });

  it('should return empty functions when services are undefined', () => {
    useScopesServices.mockReturnValue(undefined);

    const { result } = renderHook(() => useScopeActions());

    expect(result.current.selectScope).toBeInstanceOf(Function);
    expect(result.current.deselectScope).toBeInstanceOf(Function);
    expect(result.current.filterNode).toBeInstanceOf(Function);
    expect(result.current.toggleExpandedNode).toBeInstanceOf(Function);

    // Verify they don't throw
    expect(() => result.current.selectScope('test')).not.toThrow();
    expect(() => result.current.deselectScope('test')).not.toThrow();
    expect(() => result.current.filterNode('test', 'query')).not.toThrow();
    expect(() => result.current.toggleExpandedNode('test')).not.toThrow();
  });

  it('should return empty functions when scopesSelectorService is undefined', () => {
    useScopesServices.mockReturnValue({
      scopesSelectorService: undefined,
    });

    const { result } = renderHook(() => useScopeActions());

    expect(result.current.selectScope).toBeInstanceOf(Function);
    expect(result.current.deselectScope).toBeInstanceOf(Function);
    expect(result.current.filterNode).toBeInstanceOf(Function);
    expect(result.current.toggleExpandedNode).toBeInstanceOf(Function);
  });

  it('should memoize action methods to maintain stable references', () => {
    useScopesServices.mockReturnValue({
      scopesSelectorService: {
        selectScope: mockSelectScope,
        deselectScope: mockDeselectScope,
        filterNode: mockFilterNode,
        toggleExpandedNode: mockToggleExpandedNode,
      },
    });

    const { result, rerender } = renderHook(() => useScopeActions());

    const firstRender = {
      selectScope: result.current.selectScope,
      deselectScope: result.current.deselectScope,
      filterNode: result.current.filterNode,
      toggleExpandedNode: result.current.toggleExpandedNode,
    };

    rerender();

    // References should be the same after rerender
    expect(result.current.selectScope).toBe(firstRender.selectScope);
    expect(result.current.deselectScope).toBe(firstRender.deselectScope);
    expect(result.current.filterNode).toBe(firstRender.filterNode);
    expect(result.current.toggleExpandedNode).toBe(firstRender.toggleExpandedNode);
  });
});
