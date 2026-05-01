import { type JourneyHandle, locationService } from '@grafana/runtime';

/**
 * Collects cleanup functions so journey wiring doesn't need
 * manual unsub1/unsub2/unsub3 bookkeeping.
 */
export function collectUnsubs() {
  const unsubs: Array<() => void> = [];
  return {
    add: (unsub: () => void) => {
      unsubs.push(unsub);
    },
    cleanup: () => unsubs.forEach((fn) => fn()),
  };
}

/**
 * Coerces an interaction property to a string attribute. Nullish values become ''
 * so we don't emit the literal strings 'undefined' / 'null' as span attributes.
 */
export function str(value: unknown): string {
  return value == null ? '' : String(value);
}

/**
 * Subscribes to SPA route changes and ends the journey as `abandoned` when
 * `isInScope(pathname)` returns false. The framework's beforeunload + visibility
 * handlers only catch tab-level signals; in-app navigation needs explicit handling.
 *
 * Returns an unsubscribe function so callers can pass it through `collectUnsubs`.
 *
 * The first emit (the BehaviorSubject's current location at subscribe time) is
 * ignored so the journey doesn't immediately end on its own start.
 */
export function abandonOnRouteChange(handle: JourneyHandle, isInScope: (pathname: string) => boolean): () => void {
  let firstEmit = true;
  const sub = locationService.getLocationObservable().subscribe((location) => {
    if (firstEmit) {
      firstEmit = false;
      return;
    }
    if (!isInScope(location.pathname) && handle.isActive) {
      handle.end('abandoned', { abandonedAt: location.pathname });
    }
  });
  return () => sub.unsubscribe();
}
