import { useEffect, useState } from 'react';

// How long to wait before treating scopes as disabled once `enabled` flips to false. Navigating
// between pages briefly tears down and recreates the ScopesVariable (grafana/hyperion-planning#677),
// which flaps `enabled` false->true for a tick with no real scope change involved. Without this,
// that flap unmounts/remounts scopes-gated UI and can even re-trigger "new content" effects on
// every navigation. A real disable (the flag off, or no ScopesVariable at all) still resolves to
// false cleanly once the window elapses.
const DISABLE_DEBOUNCE_MS = 100;

/**
 * Debounces the false edge of `enabled` so a transient drop (see grafana/hyperion-planning#677)
 * isn't treated as a real disable. `true` always propagates immediately.
 */
export function useDebouncedScopesEnabled(enabled: boolean): boolean {
  const [debouncedEnabled, setDebouncedEnabled] = useState(enabled);

  useEffect(() => {
    if (enabled) {
      setDebouncedEnabled(true);
      return;
    }

    const id = setTimeout(() => setDebouncedEnabled(false), DISABLE_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [enabled]);

  // `enabled` itself takes priority so a false->true transition is reflected on this very render,
  // rather than lagging a render behind until the effect above commits `setDebouncedEnabled(true)`.
  // `debouncedEnabled` only matters for the false edge, while its pending timeout hasn't fired yet.
  return enabled || debouncedEnabled;
}
