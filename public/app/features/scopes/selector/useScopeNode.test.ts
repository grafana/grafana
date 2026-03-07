import { renderHook, waitFor } from '@testing-library/react';
import { BehaviorSubject } from 'rxjs';

import { ScopeNode } from '@grafana/data';

import { ScopesSelectorServiceState } from './ScopesSelectorService';
import { useScopeNode } from './useScopeNode';

// Mock the ScopesContextProvider hook
jest.mock('../ScopesContextProvider', () => ({
  useScopesServices: jest.fn(),
}));

// Mock react-use's useObservable
jest.mock('react-use', () => ({
  useObservable: jest.fn((observable$, defaultValue) => {
    // Simple implementation for testing
    let value = defaultValue;
    const subscription = observable$?.subscribe((v: unknown) => {
      value = v;
    });
    subscription?.unsubscribe();
    return value;
  }),
}));

const { useScopesServices } = jest.requireMock('../ScopesContextProvider');

describe('useScopeNode', () => {
  const mockGetScopeNode = jest.fn();

  const createMockScopeNode = (name: string): ScopeNode => ({
    metadata: { name },
    spec: {
      title: `Title ${name}`,
      nodeType: 'leaf',
      linkType: 'scope',
      linkId: `scope-${name}`,
      parentName: '',
    },
  });

  const createMockState = (nodes: Record<string, ScopeNode> = {}): ScopesSelectorServiceState => ({
    loading: false,
    loadingNodeName: undefined,
    opened: false,
    nodes,
    scopes: {},
    appliedScopes: [],
    selectedScopes: [],
    tree: {
      expanded: false,
      scopeNodeId: '',
      query: '',
      children: undefined,
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetScopeNode.mockResolvedValue(undefined);
  });

  it('should return undefined node when scopeNodeId is not provided', () => {
    const stateSubject = new BehaviorSubject(createMockState());

    useScopesServices.mockReturnValue({
      scopesSelectorService: {
        stateObservable: stateSubject.asObservable(),
        getScopeNode: mockGetScopeNode,
      },
    });

    const { result } = renderHook(() => useScopeNode(undefined));

    expect(result.current.node).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(mockGetScopeNode).not.toHaveBeenCalled();
  });

  it('should return undefined node when services are not available', () => {
    useScopesServices.mockReturnValue(undefined);

    const { result } = renderHook(() => useScopeNode('test-node'));

    expect(result.current.node).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(mockGetScopeNode).not.toHaveBeenCalled();
  });

  it('should return cached node from state', () => {
    const testNode = createMockScopeNode('test-node');
    const stateSubject = new BehaviorSubject(
      createMockState({
        'test-node': testNode,
      })
    );

    useScopesServices.mockReturnValue({
      scopesSelectorService: {
        stateObservable: stateSubject.asObservable(),
        getScopeNode: mockGetScopeNode,
      },
    });

    const { result } = renderHook(() => useScopeNode('test-node'));

    expect(result.current.node).toBe(testNode);
    expect(result.current.isLoading).toBe(false);
  });

  it('should fetch node if not in cache', async () => {
    const testNode = createMockScopeNode('test-node');
    const stateSubject = new BehaviorSubject(createMockState());

    mockGetScopeNode.mockResolvedValue(testNode);

    useScopesServices.mockReturnValue({
      scopesSelectorService: {
        stateObservable: stateSubject.asObservable(),
        state: createMockState(),
        getScopeNode: mockGetScopeNode,
      },
    });

    renderHook(() => useScopeNode('test-node'));

    await waitFor(() => {
      expect(mockGetScopeNode).toHaveBeenCalledWith('test-node');
    });
  });

  it('should set isLoading to false when node is already cached', () => {
    const testNode = createMockScopeNode('test-node');
    const stateSubject = new BehaviorSubject(
      createMockState({
        'test-node': testNode,
      })
    );

    useScopesServices.mockReturnValue({
      scopesSelectorService: {
        stateObservable: stateSubject.asObservable(),
        state: createMockState({ 'test-node': testNode }),
        getScopeNode: mockGetScopeNode,
      },
    });

    const { result } = renderHook(() => useScopeNode('test-node'));

    expect(result.current.isLoading).toBe(false);
    expect(mockGetScopeNode).not.toHaveBeenCalled();
  });

  it('should handle getScopeNode errors gracefully', async () => {
    const stateSubject = new BehaviorSubject(createMockState());

    mockGetScopeNode.mockRejectedValue(new Error('Failed to fetch'));

    useScopesServices.mockReturnValue({
      scopesSelectorService: {
        stateObservable: stateSubject.asObservable(),
        state: createMockState(),
        getScopeNode: mockGetScopeNode,
      },
    });

    const { result } = renderHook(() => useScopeNode('test-node'));

    await waitFor(() => {
      expect(mockGetScopeNode).toHaveBeenCalledWith('test-node');
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should use RxJS observable pattern for reactivity', () => {
    // This test verifies the hook uses RxJS observables for fine-grained reactivity
    const testNode = createMockScopeNode('test-node');
    const stateSubject = new BehaviorSubject(
      createMockState({
        'test-node': testNode,
      })
    );

    useScopesServices.mockReturnValue({
      scopesSelectorService: {
        stateObservable: stateSubject.asObservable(),
        state: stateSubject.getValue(),
        getScopeNode: mockGetScopeNode,
      },
    });

    const { result } = renderHook(() => useScopeNode('test-node'));

    // Verify that the hook uses the observable to get the node
    // The node should be available immediately from the state
    expect(result.current.node).toBe(testNode);
    expect(result.current.isLoading).toBe(false);

    // Since node is in cache, getScopeNode should not be called
    expect(mockGetScopeNode).not.toHaveBeenCalled();
  });
});
