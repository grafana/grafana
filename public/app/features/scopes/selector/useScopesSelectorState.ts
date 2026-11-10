import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { useScopesServices } from '../ScopesContextProvider';

import { type ScopesSelectorServiceState } from './ScopesSelectorService';
import { type NodesMap, type ScopesMap, type SelectedScope, type TreeNode } from './types';

// Mirrors the initial state in the ScopesSelectorService constructor. That state goes away with the service, so the
// copy is kept here instead of exporting the service's.
const DEFAULT_SELECTOR_STATE: ScopesSelectorServiceState = {
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
};

/**
 * Reads one field of the selector state. Every hook below passes the service state through unchanged, so what a
 * consumer receives is the same value it would get from the service. The signatures are fixed here so the source
 * can change later without touching the consumers.
 *
 * `select` must return a value that is referentially stable while the underlying field is unchanged, because
 * useSyncExternalStore compares snapshots by identity. Derive anything new with useMemo outside of `select`.
 */
function useSelectorState<T>(select: (state: ScopesSelectorServiceState) => T): T {
  const service = useScopesServices()?.scopesSelectorService;

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const subscription = service?.stateObservable?.subscribe(onStoreChange);
      return () => subscription?.unsubscribe();
    },
    [service]
  );

  // The state can be missing when the service is absent or only partly provided, so fall back to the defaults.
  return useSyncExternalStore(subscribe, () => select(service?.state ?? DEFAULT_SELECTOR_STATE));
}

/**
 * The scopes that are applied, which drive the URL and the query context.
 *
 * The service fills in a missing `scopeNodeId` by changing this array in place and emitting the same reference, so
 * this hook does not re-render for that fill-in. Read `useScopesMap` as well when a component shows the node.
 */
export function useAppliedScopes(): SelectedScope[] {
  return useSelectorState((state) => state.appliedScopes);
}

/** The IDs of the applied scopes. The array keeps its identity until the applied scopes change. */
export function useAppliedScopeIds(): string[] {
  const appliedScopes = useAppliedScopes();
  return useMemo(() => appliedScopes.map((scope) => scope.scopeId), [appliedScopes]);
}

export function useStagedScopes(): SelectedScope[] {
  return useSelectorState((state) => state.selectedScopes);
}

export function useScopesTree(): TreeNode {
  return useSelectorState((state) => state.tree);
}

/** Whether the selector drawer is open. This is separate from the dashboards navigation drawer. */
export function useScopesSelectorOpened(): boolean {
  return useSelectorState((state) => state.opened);
}

export function useLoadingNodeName(): string | undefined {
  return useSelectorState((state) => state.loadingNodeName);
}

/**
 * The cache of scope nodes the selector has loaded.
 *
 * @deprecated Temporary pass-through for the consumers that still need the whole map. It goes away when the node
 * and scope data moves to the RTK Query cache. Prefer `useScopeNode` for a single node.
 */
export function useScopeNodesMap(): NodesMap {
  return useSelectorState((state) => state.nodes);
}

/**
 * The cache of scope objects the selector has loaded.
 *
 * @deprecated Temporary pass-through, see `useScopeNodesMap`.
 */
export function useScopesMap(): ScopesMap {
  return useSelectorState((state) => state.scopes);
}
