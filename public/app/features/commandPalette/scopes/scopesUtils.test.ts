import { renderHook } from '@testing-library/react';
import { setIn } from 'immutable';
import { useObservable } from 'react-use';
import { Observable, of } from 'rxjs';

import { Scope, ScopeNode } from '@grafana/data';

import { useScopesServices } from '../../scopes/ScopesContextProvider';
import { ScopesSelectorServiceState } from '../../scopes/selector/ScopesSelectorService';
import { NodesMap, SelectedScope, TreeNode } from '../../scopes/selector/types';
import { SCOPES_PRIORITY } from '../values';

import { mapScopeNodeToAction, mapScopesNodesTreeToActions, useScopeServicesState } from './scopesUtils';

jest.mock('../../scopes/ScopesContextProvider', () => ({
  useScopesServices: jest.fn(),
}));

jest.mock('react-use', () => {
  const actual = jest.requireActual('react-use');
  return {
    ...actual,
    useObservable: jest.fn(),
  };
});

const scopeNode: ScopeNode = {
  metadata: { name: 'scope1' },
  spec: {
    title: 'Scope 1',
    nodeType: 'leaf',
    linkId: 'link1',
    parentName: 'Parent Scope',
  },
};

describe('mapScopeNodeToAction', () => {
  const mockSelectScope = jest.fn();

  it('should map a leaf scope node to an action with a parent', () => {
    const action = mapScopeNodeToAction(scopeNode, mockSelectScope, 'parent1');

    expect(action).toEqual({
      id: 'parent1/scope1',
      name: 'Scope 1',
      keywords: 'Scope 1 scope1',
      priority: SCOPES_PRIORITY,
      parent: 'parent1',
      perform: expect.any(Function),
      subtitle: 'Parent Scope',
    });
  });

  it('should map a non-leaf scope node to an action with a parent (without perform)', () => {
    const nonLeafScopeNode = setIn(scopeNode, ['spec', 'nodeType'], 'container');
    const action = mapScopeNodeToAction(nonLeafScopeNode, mockSelectScope, 'parent1');

    expect(action).toEqual({
      id: 'parent1/scope1',
      name: 'Scope 1',
      keywords: 'Scope 1 scope1',
      priority: SCOPES_PRIORITY,
      parent: 'parent1',
      subtitle: 'Parent Scope',
    });

    // Non-leaf nodes don't have a perform function
    expect(action.perform).toBeUndefined();
  });

  it('should map a scope node to an action without a parent', () => {
    const action = mapScopeNodeToAction(scopeNode, mockSelectScope);

    expect(action).toEqual({
      id: 'scopes/scope1',
      name: 'Scope 1',
      keywords: 'Scope 1 scope1',
      priority: SCOPES_PRIORITY,
      section: 'Scopes',
      subtitle: 'Parent Scope',
      perform: expect.any(Function),
    });
  });
});

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
  scope3: {
    metadata: { name: 'scope3' },
    spec: {
      title: 'Scope 3',
      nodeType: 'container',
      linkId: 'link3',
      parentName: '',
    },
  },
  scope4: {
    metadata: { name: 'scope4' },
    spec: {
      title: 'Scope 4',
      nodeType: 'leaf',
      linkId: 'link4',
      parentName: 'Scope 3',
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
    scope3: {
      scopeNodeId: 'scope3',
      expanded: true,
      query: '',
      children: {
        scope4: { scopeNodeId: 'scope4', expanded: false, children: {}, query: '' },
      },
    },
  },
};

describe('mapScopesNodesTreeToActions', () => {
  const mockSelectScope = jest.fn();

  it('should map tree nodes to actions and skip selected scopes', () => {
    const selectedScopes: SelectedScope[] = [{ scopeNodeId: 'scope2', scopeId: 'link2' }];
    const actions = mapScopesNodesTreeToActions(nodes, tree, selectedScopes, mockSelectScope);

    // We expect 4 actions: the parent action + scope1 + scope3 + scope4
    // scope2 should be skipped because it's selected
    expect(actions).toHaveLength(4);

    // Verify parent action is first
    expect(actions[0].id).toBe('scopes');

    // Verify scope1 action
    expect(actions.find((a) => a.id === 'scopes/scope1')).toBeTruthy();

    // Verify scope2 is skipped (it's selected)
    expect(actions.find((a) => a.id === 'scopes/scope2')).toBeFalsy();

    const scope3Action = actions.find((a) => a.id === 'scopes/scope3');
    expect(scope3Action).toBeTruthy();
    expect(scope3Action?.perform).toBeUndefined(); // No perform for branch nodes

    // Verify scope4 action (child of scope3)
    const scope4Action = actions.find((a) => a.id === 'scopes/scope3/scope4');
    expect(scope4Action).toBeTruthy();
    expect(scope4Action?.perform).toBeDefined();
  });

  it('should skip selected scopes if we only have scopeId of selected scope', () => {
    const selectedScopes: SelectedScope[] = [{ scopeId: 'link2' }];
    const actions = mapScopesNodesTreeToActions(nodes, tree, selectedScopes, mockSelectScope);
    expect(actions.find((a) => a.id === 'scopes/scope2')).toBeFalsy();
  });

  it('should handle empty tree children', () => {
    const nodes: NodesMap = {};
    const tree: TreeNode = {
      scopeNodeId: 'root',
      expanded: true,
      children: {},
      query: '',
    };
    const selectedScopes: SelectedScope[] = [];
    const actions = mapScopesNodesTreeToActions(nodes, tree, selectedScopes, mockSelectScope);

    // Only the parent action
    expect(actions).toHaveLength(1);
    expect(actions[0].id).toBe('scopes');
  });

  it('should handle undefined children', () => {
    const nodes: NodesMap = {};
    const tree: TreeNode = {
      scopeNodeId: 'root',
      expanded: true,
      children: undefined,
      query: '',
    };
    const selectedScopes: SelectedScope[] = [];
    const actions = mapScopesNodesTreeToActions(nodes, tree, selectedScopes, mockSelectScope);

    // Only the parent action
    expect(actions).toHaveLength(1);
    expect(actions[0].id).toBe('scopes');
  });
});

describe('useScopeServicesState', () => {
  const mockFilterNode = jest.fn();
  const mockSelectScope = jest.fn();
  const mockResetSelection = jest.fn();
  const mockSearchAllNodes = jest.fn();
  const mockGetScopeNodes = jest.fn();
  const mockApply = jest.fn();
  const mockDeselectScope = jest.fn();

  const mockScopesSelectorService = {
    filterNode: mockFilterNode,
    selectScope: mockSelectScope,
    resetSelection: mockResetSelection,
    searchAllNodes: mockSearchAllNodes,
    getScopeNodes: mockGetScopeNodes,
    apply: mockApply,
    deselectScope: mockDeselectScope,
    state: {
      loading: false,
      loadingNodeName: undefined,
      opened: false,
      nodes: {},
      scopes: {},
      selectedScopes: [],
      appliedScopes: [],
      tree: {
        scopeNodeId: '',
        expanded: false,
        query: '',
      },
    } as ScopesSelectorServiceState,
    stateObservable: new Observable(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset useObservable to use actual implementation by default
    (useObservable as jest.Mock).mockImplementation((...args) => {
      const actual = jest.requireActual('react-use');
      return actual.useObservable(...args);
    });
  });

  it('should return defaults when services are not available', () => {
    (useScopesServices as jest.Mock).mockReturnValue(null);

    const { result } = renderHook(() => useScopeServicesState());

    expect(result.current.nodes).toEqual({});
    expect(result.current.scopes).toEqual({});
    expect(result.current.selectedScopes).toEqual([]);
    expect(result.current.appliedScopes).toEqual([]);
    expect(result.current.tree).toEqual({
      scopeNodeId: '',
      expanded: false,
      query: '',
    });
    expect(result.current.filterNode).toBeDefined();
    expect(result.current.selectScope).toBeDefined();
    expect(result.current.resetSelection).toBeDefined();
    expect(result.current.searchAllNodes).toBeDefined();
    expect(result.current.getScopeNodes).toBeDefined();
    expect(result.current.apply).toBeDefined();
    expect(result.current.deselectScope).toBeDefined();
  });

  it('should return defaults when services are undefined', () => {
    (useScopesServices as jest.Mock).mockReturnValue(undefined);

    const { result } = renderHook(() => useScopeServicesState());

    expect(result.current.nodes).toEqual({});
    expect(result.current.scopes).toEqual({});
    expect(result.current.selectedScopes).toEqual([]);
    expect(result.current.appliedScopes).toEqual([]);
    expect(result.current.tree).toEqual({
      scopeNodeId: '',
      expanded: false,
      query: '',
    });
  });

  it('should return state values when services are available', () => {
    const mockNode: ScopeNode = {
      metadata: { name: 'testNode' },
      spec: {
        title: 'Test Node',
        nodeType: 'leaf',
        linkId: 'test-link',
      },
    };

    const mockScope: Scope = {
      metadata: { name: 'testScope' },
      spec: {
        title: 'Test Scope',
        filters: [],
      },
    };

    const mockState: ScopesSelectorServiceState = {
      loading: false,
      loadingNodeName: undefined,
      opened: false,
      nodes: { testNode: mockNode },
      scopes: { testScope: mockScope },
      selectedScopes: [{ scopeId: 'test' }],
      appliedScopes: [{ scopeId: 'applied' }],
      tree: {
        scopeNodeId: 'root',
        expanded: true,
        query: 'test',
      },
    };

    (useScopesServices as jest.Mock).mockReturnValue({
      scopesSelectorService: {
        ...mockScopesSelectorService,
        state: mockState,
        stateObservable: of(mockState),
      },
    });

    const { result } = renderHook(() => useScopeServicesState());

    expect(result.current.nodes).toEqual(mockState.nodes);
    expect(result.current.scopes).toEqual(mockState.scopes);
    expect(result.current.selectedScopes).toEqual(mockState.selectedScopes);
    expect(result.current.appliedScopes).toEqual(mockState.appliedScopes);
    expect(result.current.tree).toEqual(mockState.tree);
    expect(result.current.filterNode).toBe(mockFilterNode);
    expect(result.current.selectScope).toBe(mockSelectScope);
  });

  it('should return defaults when stateObservable returns undefined', () => {
    (useScopesServices as jest.Mock).mockReturnValue({
      scopesSelectorService: {
        ...mockScopesSelectorService,
        stateObservable: of(undefined),
        state: undefined,
      },
    });

    const { result } = renderHook(() => useScopeServicesState());

    expect(result.current.nodes).toEqual({});
    expect(result.current.scopes).toEqual({});
    expect(result.current.selectedScopes).toEqual([]);
    expect(result.current.appliedScopes).toEqual([]);
    expect(result.current.tree).toEqual({
      scopeNodeId: '',
      expanded: false,
      query: '',
    });
  });

  it('should always return defined values, never undefined', () => {
    (useScopesServices as jest.Mock).mockReturnValue({
      scopesSelectorService: {
        ...mockScopesSelectorService,
        stateObservable: new Observable((subscriber) => {
          subscriber.next(undefined);
        }),
        state: undefined,
      },
    });

    const { result } = renderHook(() => useScopeServicesState());

    // Ensure all values are defined (not undefined)
    expect(result.current.nodes).toBeDefined();
    expect(result.current.scopes).toBeDefined();
    expect(result.current.selectedScopes).toBeDefined();
    expect(result.current.appliedScopes).toBeDefined();
    expect(result.current.tree).toBeDefined();
    expect(result.current.nodes).not.toBeUndefined();
    expect(result.current.scopes).not.toBeUndefined();
    expect(result.current.selectedScopes).not.toBeUndefined();
    expect(result.current.appliedScopes).not.toBeUndefined();
    expect(result.current.tree).not.toBeUndefined();
  });

  it('should use new Observable when stateObservable is undefined', () => {
    (useScopesServices as jest.Mock).mockReturnValue({
      scopesSelectorService: {
        ...mockScopesSelectorService,
        stateObservable: undefined,
        state: mockScopesSelectorService.state,
      },
    });

    const { result } = renderHook(() => useScopeServicesState());

    // Should use defaultState when stateObservable is undefined
    expect(result.current.nodes).toEqual({});
    expect(result.current.scopes).toEqual({});
    expect(result.current.selectedScopes).toEqual([]);
    expect(result.current.appliedScopes).toEqual([]);
  });

  it('should use defaultState when state is undefined', () => {
    (useScopesServices as jest.Mock).mockReturnValue({
      scopesSelectorService: {
        ...mockScopesSelectorService,
        stateObservable: new Observable(),
        state: undefined,
      },
    });

    const { result } = renderHook(() => useScopeServicesState());

    // Should use defaultState when state is undefined
    expect(result.current.nodes).toEqual({});
    expect(result.current.scopes).toEqual({});
    expect(result.current.selectedScopes).toEqual([]);
    expect(result.current.appliedScopes).toEqual([]);
    expect(result.current.tree).toEqual({
      scopeNodeId: '',
      expanded: false,
      query: '',
    });
  });

  it('should use defaultState when both stateObservable and state are undefined', () => {
    (useScopesServices as jest.Mock).mockReturnValue({
      scopesSelectorService: {
        ...mockScopesSelectorService,
        stateObservable: undefined,
        state: undefined,
      },
    });

    const { result } = renderHook(() => useScopeServicesState());

    // Should use defaultState when both are undefined
    expect(result.current.nodes).toEqual({});
    expect(result.current.scopes).toEqual({});
    expect(result.current.selectedScopes).toEqual([]);
    expect(result.current.appliedScopes).toEqual([]);
    expect(result.current.tree).toEqual({
      scopeNodeId: '',
      expanded: false,
      query: '',
    });
  });

  it('should return all service methods when services are available', () => {
    (useScopesServices as jest.Mock).mockReturnValue({
      scopesSelectorService: mockScopesSelectorService,
    });

    const { result } = renderHook(() => useScopeServicesState());

    expect(result.current.filterNode).toBe(mockFilterNode);
    expect(result.current.selectScope).toBe(mockSelectScope);
    expect(result.current.resetSelection).toBe(mockResetSelection);
    expect(result.current.searchAllNodes).toBe(mockSearchAllNodes);
    expect(result.current.getScopeNodes).toBe(mockGetScopeNodes);
    expect(result.current.apply).toBe(mockApply);
    expect(result.current.deselectScope).toBe(mockDeselectScope);
  });

  it('should use defaultState when useObservable returns undefined', () => {
    (useObservable as jest.Mock).mockReturnValue(undefined);
    (useScopesServices as jest.Mock).mockReturnValue({
      scopesSelectorService: {
        ...mockScopesSelectorService,
        stateObservable: of(mockScopesSelectorService.state),
        state: mockScopesSelectorService.state,
      },
    });

    const { result } = renderHook(() => useScopeServicesState());

    // Should fall back to defaultState when useObservable returns undefined
    expect(result.current.nodes).toEqual({});
    expect(result.current.scopes).toEqual({});
    expect(result.current.selectedScopes).toEqual([]);
    expect(result.current.appliedScopes).toEqual([]);
    expect(result.current.tree).toEqual({
      scopeNodeId: '',
      expanded: false,
      query: '',
    });
    // But should still have service methods
    expect(result.current.filterNode).toBe(mockFilterNode);
    expect(result.current.selectScope).toBe(mockSelectScope);
  });
});
