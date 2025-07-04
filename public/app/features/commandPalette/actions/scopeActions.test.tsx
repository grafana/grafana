import { waitFor, renderHook } from '@testing-library/react';
import { setIn } from 'immutable';
import { useRegisterActions } from 'kbar';

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
  updateNode: jest.fn(),
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
  scopes: [],
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
    expect(useRegisterActions).not.toHaveBeenCalled();
  });

  it('should register scope tree actions and return scopesRow when scopes are selected', () => {
    const mockUpdateNode = jest.fn();

    // First run with empty scopes in the scopes service
    (useScopeServicesState as jest.Mock).mockReturnValue({
      ...mockScopeServicesState,
      updateNode: mockUpdateNode,
      selectedScopes: [{ scopeId: 'scope1', name: 'Scope 1' }],
    });

    const { result, rerender } = renderHook(() => {
      return useRegisterScopesActions('', jest.fn());
    });

    expect(mockUpdateNode).toHaveBeenCalledWith('', true, '');
    expect(useRegisterActions).toHaveBeenLastCalledWith([rootScopeAction], [[rootScopeAction]]);
    expect(result.current.scopesRow).toBeDefined();

    // Simulate loading of scopes in the service
    (useScopeServicesState as jest.Mock).mockReturnValue({
      ...mockScopeServicesState,
      updateNode: mockUpdateNode,
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
    const mockUpdateNode = jest.fn();

    // First run with empty scopes in the scopes service
    (useScopeServicesState as jest.Mock).mockReturnValue({
      ...mockScopeServicesState,
      updateNode: mockUpdateNode,
      nodes,
      tree,
    });

    renderHook(() => {
      return useRegisterScopesActions('', jest.fn(), 'scopes/scope1');
    });

    expect(mockUpdateNode).toHaveBeenCalledWith('scope1', true, '');
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
    const mockUpdateNode = jest.fn();

    // First run with empty scopes in the scopes service
    (useScopeServicesState as jest.Mock).mockReturnValue({
      ...mockScopeServicesState,
      updateNode: mockUpdateNode,
      nodes,
      tree,
    });

    renderHook(() => {
      return useRegisterScopesActions('something', jest.fn(), 'scopes/scope1');
    });

    expect(mockUpdateNode).toHaveBeenCalledWith('scope1', true, 'something');
    expect(mockScopeServicesState.searchAllNodes).not.toHaveBeenCalled();
  });

  it('should not use global scope search if feature flag is off', async () => {
    config.featureToggles.scopeSearchAllLevels = false;
    const mockUpdateNode = jest.fn();
    // First run with empty scopes in the scopes service
    (useScopeServicesState as jest.Mock).mockReturnValue({
      ...mockScopeServicesState,
      updateNode: mockUpdateNode,
      nodes,
      tree,
    });

    renderHook(() => {
      return useRegisterScopesActions('something', jest.fn(), '');
    });

    expect(mockUpdateNode).toHaveBeenCalledWith('', true, 'something');
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
});
