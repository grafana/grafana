import { useMemo } from 'react';
import { useObservable } from 'react-use';
import { Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

import { useScopesServices } from '../ScopesContextProvider';

import { NodesMap } from './types';

/**
 * Hook that provides the full scopeNodes map for components that need to render multiple nodes.
 * Uses RxJS distinctUntilChanged with shallow comparison to only re-render when the map reference changes.
 *
 * This eliminates the need to drill scopeNodes through multiple component layers.
 */
export function useScopesTree(): NodesMap {
  const services = useScopesServices();
  const selector = services?.scopesSelectorService;

  const scopeNodes = useObservable(
    useMemo(
      () =>
        selector
          ? selector.stateObservable.pipe(
              map((state) => state.nodes),
              distinctUntilChanged() // Shallow comparison on the map reference
            )
          : // Return an observable that emits an empty map if selector is not available
            new Observable<NodesMap>((subscriber) => {
              subscriber.next({});
            }),
      [selector]
    ),
    {} // Default value
  );

  return scopeNodes ?? {};
}
