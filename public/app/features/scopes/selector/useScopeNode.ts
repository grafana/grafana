import { useEffect, useMemo, useState } from 'react';
import { useObservable } from 'react-use';
import { Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

import { ScopeNode } from '@grafana/data';

import { useScopesServices } from '../ScopesContextProvider';

/**
 * Hook that provides a specific scope node with fine-grained reactivity.
 *
 * This hook:
 * 1. Subscribes to the RxJS state for the specific node (fine-grained updates)
 * 2. Automatically fetches the node if it's not in the cache
 * 3. Returns the node and loading state
 *
 * Components using this hook will only re-render when this specific node changes,
 * not when any other node in the tree changes.
 */
export function useScopeNode(scopeNodeId?: string) {
  const [isLoading, setIsLoading] = useState(false);
  const services = useScopesServices();
  const selector = services?.scopesSelectorService;

  // Subscribe to the specific node in state for fine-grained reactivity
  const node = useObservable(
    useMemo(
      () =>
        selector
          ? selector.stateObservable.pipe(
              map((state) => (scopeNodeId ? state.nodes[scopeNodeId] : undefined)),
              distinctUntilChanged()
            )
          : // Return an observable that emits undefined if selector is not available
            new Observable<ScopeNode | undefined>((subscriber) => {
              subscriber.next(undefined);
            }),
      [selector, scopeNodeId]
    ),
    undefined
  );

  // Fetch node if not in cache (preserve existing behavior)
  useEffect(() => {
    const loadNode = async () => {
      if (!scopeNodeId || !selector || node) {
        return;
      }
      setIsLoading(true);
      try {
        await selector.getScopeNode(scopeNodeId);
      } catch (error) {
        console.error('Failed to load node', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadNode();
  }, [scopeNodeId, selector, node]);

  return { node, isLoading };
}
