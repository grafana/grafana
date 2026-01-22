import { useEffect, useMemo, useState } from 'react';
import { useObservable } from 'react-use';
import { Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

import { ScopeNode } from '@grafana/data';

import { useScopesServices } from '../ScopesContextProvider';

/**
 * Hook that subscribes to a specific scope node from the service state using RxJS.
 * Provides fine-grained reactivity - only re-renders when the specific node changes.
 * Automatically fetches the node if it's not in cache.
 */
export function useScopeNode(scopeNodeId?: string) {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const services = useScopesServices();
  const selector = services?.scopesSelectorService;

  // Subscribe to the specific node in state for fine-grained reactivity
  const node: ScopeNode | undefined = useObservable(
    useMemo(
      () =>
        selector?.stateObservable.pipe(
          map((s) => (scopeNodeId ? s.nodes[scopeNodeId] : undefined)),
          distinctUntilChanged()
        ) ?? new Observable(),
      [selector, scopeNodeId]
    ),
    undefined
  );

  // Fetch node if not in cache (preserve existing behavior)
  useEffect(() => {
    if (!scopeNodeId || !selector) {
      setIsLoading(false);
      return;
    }

    // If we already have the node, we're not loading
    if (node) {
      setIsLoading(false);
      return;
    }

    // Start loading and fetch the node
    setIsLoading(true);
    selector
      .getScopeNode(scopeNodeId)
      .then(() => {
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, [scopeNodeId, selector, node]);

  return { node, isLoading };
}
