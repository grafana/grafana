import { act, renderHook } from '@testing-library/react';
import { BehaviorSubject } from 'rxjs';

import { type ScopesSelectorServiceState } from './ScopesSelectorService';
import {
  useAppliedScopeIds,
  useAppliedScopes,
  useLoadingNodeName,
  useScopeNodesMap,
  useScopesMap,
  useScopesSelectorOpened,
  useScopesTree,
  useStagedScopes,
} from './useScopesSelectorState';

jest.mock('../ScopesContextProvider', () => ({
  useScopesServices: jest.fn(),
}));

const { useScopesServices } = jest.requireMock('../ScopesContextProvider');

function createState(overrides: Partial<ScopesSelectorServiceState> = {}): ScopesSelectorServiceState {
  return {
    loading: false,
    loadingNodeName: undefined,
    opened: false,
    nodes: {},
    scopes: {},
    selectedScopes: [],
    appliedScopes: [],
    tree: { scopeNodeId: '', expanded: false, query: '' },
    ...overrides,
  };
}

function createService(initial: ScopesSelectorServiceState) {
  const subject = new BehaviorSubject(initial);
  return {
    subject,
    service: {
      get state() {
        return subject.getValue();
      },
      stateObservable: subject.asObservable(),
    },
  };
}

function provide(service: unknown) {
  useScopesServices.mockReturnValue({ scopesSelectorService: service });
}

describe('useScopesSelectorState hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes each field of the service state through unchanged', () => {
    const state = createState({
      appliedScopes: [{ scopeId: 'applied', scopeNodeId: 'node-applied' }],
      selectedScopes: [{ scopeId: 'staged' }],
      opened: true,
      loadingNodeName: 'loading-node',
      tree: { scopeNodeId: 'root', expanded: true, query: 'q' },
    });
    provide(createService(state).service);

    expect(renderHook(() => useAppliedScopes()).result.current).toBe(state.appliedScopes);
    expect(renderHook(() => useStagedScopes()).result.current).toBe(state.selectedScopes);
    expect(renderHook(() => useScopesSelectorOpened()).result.current).toBe(true);
    expect(renderHook(() => useLoadingNodeName()).result.current).toBe('loading-node');
    expect(renderHook(() => useScopesTree()).result.current).toBe(state.tree);
    expect(renderHook(() => useScopeNodesMap()).result.current).toBe(state.nodes);
    expect(renderHook(() => useScopesMap()).result.current).toBe(state.scopes);
  });

  it('updates when the field it reads changes', () => {
    const { service, subject } = createService(createState());
    provide(service);
    const { result } = renderHook(() => useStagedScopes());
    expect(result.current).toEqual([]);

    act(() => subject.next(createState({ selectedScopes: [{ scopeId: 'a' }] })));

    expect(result.current).toEqual([{ scopeId: 'a' }]);
  });

  it('does not rerender when a different field changes', () => {
    const state = createState();
    const { service, subject } = createService(state);
    provide(service);
    let renders = 0;
    renderHook(() => {
      renders++;
      return useStagedScopes();
    });
    const rendersAfterMount = renders;

    act(() => subject.next({ ...state, opened: true, loading: true }));

    expect(renders).toBe(rendersAfterMount);
  });

  it('keeps the applied scope IDs array stable until the applied scopes change', () => {
    const state = createState({ appliedScopes: [{ scopeId: 'one' }, { scopeId: 'two' }] });
    const { service, subject } = createService(state);
    provide(service);
    const { result, rerender } = renderHook(() => useAppliedScopeIds());

    const first = result.current;
    expect(first).toEqual(['one', 'two']);
    rerender();
    expect(result.current).toBe(first);

    act(() => subject.next({ ...state, opened: true }));
    expect(result.current).toBe(first);

    act(() => subject.next({ ...state, appliedScopes: [{ scopeId: 'three' }] }));
    expect(result.current).toEqual(['three']);
  });

  it('picks up a change that happens after render and before the subscription', () => {
    const { service, subject } = createService(createState());
    provide(service);
    let first = true;

    const { result } = renderHook(() => {
      const value = useStagedScopes();
      if (first) {
        first = false;
        subject.next(createState({ selectedScopes: [{ scopeId: 'late' }] }));
      }
      return value;
    });

    expect(result.current).toEqual([{ scopeId: 'late' }]);
  });

  it('stops listening when it unmounts', () => {
    const { service, subject } = createService(createState());
    provide(service);
    const { unmount } = renderHook(() => useStagedScopes());
    expect(subject.observed).toBe(true);

    unmount();

    expect(subject.observed).toBe(false);
  });

  it('returns the defaults when the services are not available', () => {
    useScopesServices.mockReturnValue(undefined);

    expect(renderHook(() => useAppliedScopes()).result.current).toEqual([]);
    expect(renderHook(() => useAppliedScopeIds()).result.current).toEqual([]);
    expect(renderHook(() => useScopesSelectorOpened()).result.current).toBe(false);
    expect(renderHook(() => useScopesTree()).result.current).toEqual({ scopeNodeId: '', expanded: false, query: '' });
  });

  it('returns the defaults when the service has no state', () => {
    provide({});
    expect(renderHook(() => useStagedScopes()).result.current).toEqual([]);

    provide({ state: undefined, stateObservable: new BehaviorSubject(undefined) });
    expect(renderHook(() => useStagedScopes()).result.current).toEqual([]);
  });

  it('returns the same default value on every render', () => {
    useScopesServices.mockReturnValue(undefined);
    const { result, rerender } = renderHook(() => useAppliedScopes());
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});
