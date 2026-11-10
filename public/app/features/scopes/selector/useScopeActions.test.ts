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

  describe('apply, selector and lookup actions', () => {
    const passThroughActions = [
      'apply',
      'closeAndApply',
      'closeAndReset',
      'resetSelection',
      'removeAllScopes',
      'open',
      'searchAllNodes',
      'getScopeNode',
      'getScopeNodes',
    ] as const;

    it.each(passThroughActions)('should return %s from scopesSelectorService unchanged', (name) => {
      const action = jest.fn();
      useScopesServices.mockReturnValue({ scopesSelectorService: { [name]: action } });

      const { result } = renderHook(() => useScopeActions());

      expect(result.current[name]).toBe(action);
    });

    describe('changeScopes', () => {
      it('should pass the options to the service as its positional arguments', () => {
        const changeScopes = jest.fn().mockResolvedValue(undefined);
        useScopesServices.mockReturnValue({ scopesSelectorService: { changeScopes } });

        const { result } = renderHook(() => useScopeActions());
        result.current.changeScopes(['a', 'b'], { scopeNodeId: 'node-a', redirect: false });

        expect(changeScopes).toHaveBeenCalledWith(['a', 'b'], undefined, 'node-a', false);
      });

      it('should redirect by default, like selecting in the drawer', () => {
        const changeScopes = jest.fn().mockResolvedValue(undefined);
        useScopesServices.mockReturnValue({ scopesSelectorService: { changeScopes } });

        const { result } = renderHook(() => useScopeActions());
        result.current.changeScopes(['a']);

        expect(changeScopes).toHaveBeenCalledWith(['a'], undefined, undefined, true);
      });

      it('should return the promise of the service call', async () => {
        let resolve: () => void = () => {};
        const pending = new Promise<void>((r) => (resolve = r));
        useScopesServices.mockReturnValue({
          scopesSelectorService: { changeScopes: jest.fn().mockReturnValue(pending) },
        });

        const { result } = renderHook(() => useScopeActions());
        const returned = result.current.changeScopes(['a']);

        expect(returned).toBe(pending);
        resolve();
        await expect(returned).resolves.toBeUndefined();
      });

      it('should resolve without calling anything when the service or its method is missing', async () => {
        useScopesServices.mockReturnValue(undefined);
        const { result: noServices } = renderHook(() => useScopeActions());
        await expect(noServices.current.changeScopes(['a'])).resolves.toBeUndefined();

        useScopesServices.mockReturnValue({ scopesSelectorService: {} });
        const { result: noMethod } = renderHook(() => useScopeActions());
        await expect(noMethod.current.changeScopes(['a'])).resolves.toBeUndefined();
      });

      it('should look the service method up when called, not when rendered', () => {
        const service = { changeScopes: jest.fn() };
        useScopesServices.mockReturnValue({ scopesSelectorService: service });

        const { result } = renderHook(() => useScopeActions());
        const replacement = jest.fn();
        service.changeScopes = replacement;
        result.current.changeScopes(['a']);

        expect(replacement).toHaveBeenCalled();
      });
    });

    describe('isAvailable', () => {
      it('should be true when there is a selector service, even a partial one', () => {
        useScopesServices.mockReturnValue({ scopesSelectorService: {} });

        const { result } = renderHook(() => useScopeActions());

        expect(result.current.isAvailable).toBe(true);
      });

      it.each([
        ['there are no services', undefined],
        ['the services have no selector service', { scopesSelectorService: undefined }],
      ])('should be false when %s', (_, services) => {
        useScopesServices.mockReturnValue(services);

        const { result } = renderHook(() => useScopeActions());

        expect(result.current.isAvailable).toBe(false);
      });
    });

    it('should return harmless defaults when the service members are missing', async () => {
      useScopesServices.mockReturnValue({ scopesSelectorService: {} });

      const { result } = renderHook(() => useScopeActions());

      await expect(result.current.searchAllNodes('q', 5)).resolves.toEqual([]);
      await expect(result.current.getScopeNodes(['a'])).resolves.toEqual([]);
      await expect(result.current.getScopeNode('a')).resolves.toBeUndefined();
      expect(() => result.current.closeAndReset()).not.toThrow();
      expect(() => result.current.removeAllScopes()).not.toThrow();
      expect(result.current.getAppliedScopes()).toEqual([]);
    });

    it('should call setRedirectEnabled on the service with its own this', () => {
      const service = {
        redirectEnabled: true,
        setRedirectEnabled(enabled: boolean) {
          this.redirectEnabled = enabled;
        },
      };
      useScopesServices.mockReturnValue({ scopesSelectorService: service });

      const { result } = renderHook(() => useScopeActions());
      result.current.setRedirectEnabled(false);

      expect(service.redirectEnabled).toBe(false);
    });

    it('should see a setRedirectEnabled spy that is installed after mount', () => {
      // A plain method, so that spyOn replaces the property. spyOn on an existing jest.fn returns that same mock.
      const service = {
        setRedirectEnabled(_enabled: boolean) {},
      };
      useScopesServices.mockReturnValue({ scopesSelectorService: service });

      const { result } = renderHook(() => useScopeActions());
      const spy = jest.spyOn(service, 'setRedirectEnabled');
      result.current.setRedirectEnabled(true);

      expect(spy).toHaveBeenCalledWith(true);
    });

    it('should not throw from setRedirectEnabled when services are undefined', () => {
      useScopesServices.mockReturnValue(undefined);

      const { result } = renderHook(() => useScopeActions());

      expect(() => result.current.setRedirectEnabled(true)).not.toThrow();
    });

    it('should read the applied scopes at call time, not at render time', () => {
      const service = { state: { appliedScopes: [{ scopeId: 'before' }] } };
      useScopesServices.mockReturnValue({ scopesSelectorService: service });

      const { result } = renderHook(() => useScopeActions());
      expect(result.current.getAppliedScopes()).toEqual([{ scopeId: 'before' }]);

      service.state = { appliedScopes: [{ scopeId: 'after' }] };

      expect(result.current.getAppliedScopes()).toEqual([{ scopeId: 'after' }]);
    });

    it('should keep the synchronous getter and setRedirectEnabled stable across rerenders', () => {
      useScopesServices.mockReturnValue({ scopesSelectorService: { state: { appliedScopes: [] } } });

      const { result, rerender } = renderHook(() => useScopeActions());
      const { getAppliedScopes, setRedirectEnabled } = result.current;

      rerender();

      expect(result.current.getAppliedScopes).toBe(getAppliedScopes);
      expect(result.current.setRedirectEnabled).toBe(setRedirectEnabled);
    });
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
