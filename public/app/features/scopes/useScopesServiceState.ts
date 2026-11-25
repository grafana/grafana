import { useCallback, useSyncExternalStore } from 'react';
import { type Observable } from 'rxjs';

interface ObservableState<S> {
  state: S;
  stateObservable: Observable<S>;
}

/**
 * Reads a value from the state of a scopes service and rerenders when that value changes.
 *
 * `select` must return a value that is referentially stable while the underlying field is unchanged, because
 * useSyncExternalStore compares snapshots by identity. Derive anything new with useMemo outside of `select`.
 *
 * The service can be missing, or only partly provided in a test, so the state falls back to `defaults`.
 */
export function useScopesServiceState<S, T>(
  service: Partial<ObservableState<S>> | undefined,
  defaults: S,
  select: (state: S) => T
): T {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const subscription = service?.stateObservable?.subscribe(onStoreChange);
      return () => subscription?.unsubscribe();
    },
    [service]
  );

  return useSyncExternalStore(subscribe, () => select(service?.state ?? defaults));
}
