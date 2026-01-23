import { waitFor, renderHook } from '@testing-library/react';
import { setIn } from 'immutable';
import { useRegisterActions } from 'kbar';

import { ScopeNode } from '@grafana/data';
import { config } from '@grafana/runtime';

import { NodesMap, TreeNode } from '../../scopes/selector/types';

import { useRegisterScopesActions } from './scopeActions';
import { useScopeServicesState } from './scopesUtils';

// Mock dependencies
jest.mock('kbar', () => ({
  useRegisterActions: jest.fn(),
}));

jest.mock('./scopesUtils', () => {
  return {
    ...jest.requireActual('./scopesUtils'),
    useScopeServicesState: jest.fn(),
  };
});

const mockScopeServicesState = {
  filterNode: jest.fn(),
  selectScope: jest.fn(),
  resetSelection: jest.fn(),
  nodes: {},
  tree: {
    scopeNodeId: '',
    expanded: false,
    query: '',
  },
  selectedScopes: [],
  appliedScopes: [],
  deselectScope: jest.fn(),
  apply: jest.fn(),
  searchAllNodes: jest.fn(),
  getScopeNodes: jest.fn(),
  scopes: {},
};

const rootScopeAction = {
  id: 'scopes',
  keywords: 'scopes filters',
  name: 'Scopes',
  priority: 8,
  section: 'Scopes',
};

const nodes: NodesMap = {
  scope1: {
    metadata: { name: 'scope1' },
    spec: {
      title: 'Scope 1',
      nodeType: 'leaf',
      linkId: 'link1',
      parentName: '',
    },
  },
  scope2: {
    metadata: { name: 'scope2' },
    spec: {
      title: 'Scope 2',
      nodeType: 'leaf',
      linkId: 'link2',
      parentName: '',
    },
  },
};

const tree: TreeNode = {
  scopeNodeId: 'root',
  expanded: true,
  query: '',
  children: {
    scope1: { scopeNodeId: 'scope1', expanded: false, children: {}, query: '' },
    scope2: { scopeNodeId: 'scope2', expanded: false, children: {}, query: '' },
  },
};

describe('useRegisterScopesActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useScopeServicesState as jest.Mock).mockReturnValue(mockScopeServicesState);
    config.featureToggles.scopeFilters = true;
    config.featureToggles.scopeSearchAllLevels = true;
  });

  it('should return undefined scopesRow when feature toggle is off', () => {
    config.featureToggles.scopeFilters = false;

    const onApply = jest.fn();
    const { result } = renderHook(() => {
      return useRegisterScopesActions('', onApply);
    });

    expect(result.current.scopesRow).toBeUndefined();
    // useRegisterActions is called unconditionally (to follow React Hooks rules) but with empty array when feature toggle is off
    expect(useRegisterActions).toHaveBeenCalledWith([], [[]]);
  });

  it('should register scope tree actions and return scopesRow when scopes are selected', () => {
    const mockFilterNode = jest.fn();

    // First run with empty scopes in the scopes service
    (useScopeServicesState as jest.Mock).mockReturnValue({
      ...mockScopeServicesState,
      filterNode: mockFilterNode,
      selectedScopes: [{ scopeId: 'scope1', name: 'Scope 1' }],
    });

    const { result, rerender } = renderHook(() => {
      return useRegisterScopesActions('', jest.fn());
    });

    expect(mockFilterNode).toHaveBeenCalledWith('', '');
    expect(useRegisterActions).toHaveBeenLastCalledWith([rootScopeAction], [[rootScopeAction]]);
    expect(result.current.scopesRow).toBeDefined();

    // Simulate loading of scopes in the service
    (useScopeServicesState as jest.Mock).mockReturnValue({
      ...mockScopeServicesState,
      filterNode: mockFilterNode,
      selectedScopes: [{ scopeId: 'scope1', name: 'Scope 1' }],
      nodes,
      tree,
      appliedScopes: [],
    });

    const actions = [
      rootScopeAction,
      {
        id: 'scopes/scope1',
        keywords: 'Scope 1 scope1',
        name: 'Scope 1',
        parent: 'scopes',
        perform: expect.any(Function),
        priority: 8,
      },
      {
        id: 'scopes/scope2',
        keywords: 'Scope 2 scope2',
        name: 'Scope 2',
        parent: 'scopes',
        perform: expect.any(Function),
        priority: 8,
      },
    ];

    rerender();
    expect(useRegisterActions).toHaveBeenLastCalledWith(actions, [actions]);
  });

  it('should load next level of scopes', () => {
    const mockFilterNode = jest.fn();

    // First run with empty scopes in the scopes service
    (useScopeServicesState as jest.Mock).mockReturnValue({
      ...mockScopeServicesState,
      filterNode: mockFilterNode,
      nodes,
      tree,
    });

    renderHook(() => {
      return useRegisterScopesActions('', jest.fn(), 'scopes/scope1');
    });

    expect(mockFilterNode).toHaveBeenCalledWith('scope1', '');
  });

  it('does not return component if no scopes are selected', () => {
    const { result } = renderHook(() => {
      return useRegisterScopesActions('', jest.fn(), 'scopes/scope1');
    });
    expect(result.current.scopesRow).toBeNull();
  });

  it('should use global scope search when in global cmdk level', async () => {
    mockScopeServicesState.searchAllNodes.mockResolvedValue([
      setIn(nodes.scope1, ['spec', 'parentName'], 'some parent'),
    ]);

    renderHook(() => {
      return useRegisterScopesActions('scopes1', jest.fn());
    });

    // Wait for the async search to complete
    await waitFor(() => {
      expect(mockScopeServicesState.searchAllNodes).toHaveBeenCalledWith('scopes1', 10);
    });

    const actions = [
      rootScopeAction,
      {
        id: 'scopes/scope1',
        keywords: 'Scope 1 scope1',
        name: 'Scope 1',
        perform: expect.any(Function),
        priority: 8,
        section: 'Scopes',
        subtitle: 'some parent',
      },
    ];

    expect(useRegisterActions).toHaveBeenLastCalledWith(actions, [actions]);
  });

  it('should use global scope search when "scope" cmdk level', async () => {
    mockScopeServicesState.searchAllNodes.mockResolvedValue([
      setIn(nodes.scope1, ['spec', 'parentName'], 'some parent'),
    ]);

    renderHook(() => {
      return useRegisterScopesActions('scopes1', jest.fn(), 'scopes');
    });

    // Wait for the async search to complete
    await waitFor(() => {
      expect(mockScopeServicesState.searchAllNodes).toHaveBeenCalledWith('scopes1', 10);
    });

    const actions = [
      rootScopeAction,
      {
        id: 'scopes/scope1',
        keywords: 'Scope 1 scope1',
        name: 'Scope 1',
        perform: expect.any(Function),
        priority: 8,
        // The main difference here is that we map it to a parent if we are in the "scopes" section of the cmdK.
        // In the previous test the scope actions were mapped to global level to show correctly.
        parent: 'scopes',
        subtitle: 'some parent',
      },
    ];

    expect(useRegisterActions).toHaveBeenLastCalledWith(actions, [actions]);
  });

  it('should filter non leaf nodes from global scope search', async () => {
    mockScopeServicesState.searchAllNodes.mockResolvedValue([
      nodes.scope1,
      setIn(nodes.scope2, ['spec', 'nodeType'], 'container'),
    ]);

    renderHook(() => {
      return useRegisterScopesActions('scopes1', jest.fn());
    });
    await waitFor(() => {
      expect(mockScopeServicesState.searchAllNodes).toHaveBeenCalledWith('scopes1', 10);
    });

    // Checking the second call as first one registers just the global scopes action
    expect((useRegisterActions as jest.Mock).mock.calls[1][0]).toHaveLength(2);
    expect((useRegisterActions as jest.Mock).mock.calls[1][0]).toMatchObject([
      { id: 'scopes' },
      { id: 'scopes/scope1' },
    ]);
  });

  it('should not use global scope search when searching in some deeper scope category', async () => {
    const mockFilterNode = jest.fn();

    // First run with empty scopes in the scopes service
    (useScopeServicesState as jest.Mock).mockReturnValue({
      ...mockScopeServicesState,
      filterNode: mockFilterNode,
      nodes,
      tree,
    });

    renderHook(() => {
      return useRegisterScopesActions('something', jest.fn(), 'scopes/scope1');
    });

    expect(mockFilterNode).toHaveBeenCalledWith('scope1', 'something');
    expect(mockScopeServicesState.searchAllNodes).not.toHaveBeenCalled();
  });

  it('should not use global scope search if feature flag is off', async () => {
    config.featureToggles.scopeSearchAllLevels = false;
    const mockFilterNode = jest.fn();
    // First run with empty scopes in the scopes service
    (useScopeServicesState as jest.Mock).mockReturnValue({
      ...mockScopeServicesState,
      filterNode: mockFilterNode,
      nodes,
      tree,
    });

    renderHook(() => {
      return useRegisterScopesActions('something', jest.fn(), '');
    });

    expect(mockFilterNode).toHaveBeenCalledWith('', 'something');
    expect(mockScopeServicesState.searchAllNodes).not.toHaveBeenCalled();
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => {
      return useRegisterScopesActions('', jest.fn(), '');
    });

    expect(mockScopeServicesState.resetSelection).toHaveBeenCalledTimes(1);
    unmount();
    expect(mockScopeServicesState.resetSelection).toHaveBeenCalledTimes(2);
  });

  it('should handle empty nodes and scopes correctly', () => {
    (useScopeServicesState as jest.Mock).mockReturnValue({
      ...mockScopeServicesState,
      nodes: {},
      scopes: {},
      selectedScopes: [],
      appliedScopes: [],
      tree: {
        scopeNodeId: '',
        expanded: false,
        query: '',
      },
    });

    const { result } = renderHook(() => {
      return useRegisterScopesActions('', jest.fn());
    });

    // Should still register the root scope action even with empty nodes
    expect(useRegisterActions).toHaveBeenCalled();
    expect(result.current.scopesRow).toBeNull();
  });

  it('should handle isDirty calculation with empty arrays', () => {
    (useScopeServicesState as jest.Mock).mockReturnValue({
      ...mockScopeServicesState,
      selectedScopes: [],
      appliedScopes: [],
    });

    const { result } = renderHook(() => {
      return useRegisterScopesActions('', jest.fn());
    });

    // When both are empty, isDirty should be false, so scopesRow should be null
    expect(result.current.scopesRow).toBeNull();
  });

  it('should show scopesRow when isDirty is true', () => {
    (useScopeServicesState as jest.Mock).mockReturnValue({
      ...mockScopeServicesState,
      selectedScopes: [{ scopeId: 'scope1' }],
      appliedScopes: [],
    });

    const { result } = renderHook(() => {
      return useRegisterScopesActions('', jest.fn());
    });

    // Should show scopesRow when there's a difference between selected and applied
    expect(result.current.scopesRow).toBeDefined();
  });

  it('should show scopesRow when selectedScopes has items even if not dirty', () => {
    const appliedScopes = [{ scopeId: 'scope1' }];
    (useScopeServicesState as jest.Mock).mockReturnValue({
      ...mockScopeServicesState,
      selectedScopes: [{ scopeId: 'scope1' }],
      appliedScopes,
    });

    const { result } = renderHook(() => {
      return useRegisterScopesActions('', jest.fn());
    });

    // Should show scopesRow when selectedScopes has items, even if not dirty
    expect(result.current.scopesRow).toBeDefined();
  });

  it('should handle useGlobalScopesSearch when useMultipleScopeNodesEndpoint is enabled', async () => {
    config.featureToggles.useMultipleScopeNodesEndpoint = true;
    const mockGetScopeNodes = jest.fn().mockResolvedValue([
      {
        metadata: { name: 'parent1' },
        spec: { title: 'Parent 1', nodeType: 'container' },
      },
    ]);

    (useScopeServicesState as jest.Mock).mockReturnValue({
      ...mockScopeServicesState,
      getScopeNodes: mockGetScopeNodes,
      searchAllNodes: jest.fn().mockResolvedValue([
        {
          metadata: { name: 'scope1' },
          spec: {
            title: 'Scope 1',
            nodeType: 'leaf',
            parentName: 'parent1',
          },
        },
      ]),
    });

    renderHook(() => {
      return useRegisterScopesActions('test', jest.fn());
    });

    await waitFor(() => {
      expect(mockGetScopeNodes).toHaveBeenCalled();
    });

    config.featureToggles.useMultipleScopeNodesEndpoint = false;
  });

  it('should clear actions when search query changes quickly (race condition)', async () => {
    const mockSearchAllNodes = jest.fn();
    let resolveFirst: ((value: ScopeNode[]) => void) | undefined;
    const firstPromise = new Promise<ScopeNode[]>((resolve) => {
      resolveFirst = resolve;
    });

    mockSearchAllNodes.mockReturnValueOnce(firstPromise).mockResolvedValueOnce([]);

    (useScopeServicesState as jest.Mock).mockReturnValue({
      ...mockScopeServicesState,
      searchAllNodes: mockSearchAllNodes,
    });

    const { rerender } = renderHook(({ searchQuery }) => useRegisterScopesActions(searchQuery, jest.fn()), {
      initialProps: { searchQuery: 'first' },
    });

    // Change search query before first promise resolves
    rerender({ searchQuery: 'second' });

    // Resolve first promise - should be ignored due to searchQueryRef check
    if (resolveFirst) {
      resolveFirst([
        {
          metadata: { name: 'scope1' },
          spec: { title: 'Scope 1', nodeType: 'leaf' },
        },
      ]);
    }

    await waitFor(() => {
      // Second search should be initiated
      expect(mockSearchAllNodes).toHaveBeenCalledTimes(2);
    });
  });

  it('should handle keyboard shortcut for applying scopes', () => {
    const mockApply = jest.fn();
    const onApply = jest.fn();

    (useScopeServicesState as jest.Mock).mockReturnValue({
      ...mockScopeServicesState,
      selectedScopes: [{ scopeId: 'scope1' }],
      appliedScopes: [],
      apply: mockApply,
    });

    renderHook(() => {
      return useRegisterScopesActions('', onApply);
    });

    // Simulate Cmd+Enter keypress
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      metaKey: true,
    });
    window.dispatchEvent(event);

    expect(mockApply).toHaveBeenCalled();
    expect(onApply).toHaveBeenCalled();
  });

  it('should not trigger keyboard shortcut when not dirty', () => {
    const mockApply = jest.fn();
    const onApply = jest.fn();

    (useScopeServicesState as jest.Mock).mockReturnValue({
      ...mockScopeServicesState,
      selectedScopes: [{ scopeId: 'scope1' }],
      appliedScopes: [{ scopeId: 'scope1' }],
      apply: mockApply,
    });

    renderHook(() => {
      return useRegisterScopesActions('', onApply);
    });

    // Simulate Cmd+Enter keypress when not dirty
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      metaKey: true,
    });
    window.dispatchEvent(event);

    // Should not call apply when not dirty
    expect(mockApply).not.toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('should clear global search actions when parentId is set to a non-scopes value', () => {
    const mockSearchAllNodes = jest.fn().mockResolvedValue([]);

    (useScopeServicesState as jest.Mock).mockReturnValue({
      ...mockScopeServicesState,
      searchAllNodes: mockSearchAllNodes,
    });

    const { rerender } = renderHook(
      ({ parentId }: { parentId: string | null | undefined }) => useRegisterScopesActions('test', jest.fn(), parentId),
      {
        initialProps: { parentId: null as string | null },
      }
    );

    // First render with no parentId should trigger search
    expect(mockSearchAllNodes).toHaveBeenCalled();

    // Change to a non-scopes parentId
    rerender({ parentId: 'other/parent' as string | null });

    // Should not trigger another search
    expect(mockSearchAllNodes).toHaveBeenCalledTimes(1);
  });
});
