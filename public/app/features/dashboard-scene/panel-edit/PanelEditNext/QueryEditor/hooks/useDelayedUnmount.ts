import { useEffect, useRef, useState } from 'react';

// Returns `true` while the element should be in the DOM. Stays `true` for
// `exitMs` after `visible` flips to false so the caller can run an exit
// animation before unmounting.
export function useDelayedUnmount(visible: boolean, exitMs: number): boolean {
  const [rendered, setRendered] = useState(visible);
  // Track whether the element has ever been visible so we can skip scheduling
  // a no-op exit timer for instances that mount in the closed state.
  const hasEverRendered = useRef(visible);

  useEffect(() => {
    if (visible) {
      hasEverRendered.current = true;
      setRendered(true);
      return;
    }
    if (!hasEverRendered.current) {
      return;
    }
    const id = window.setTimeout(() => setRendered(false), exitMs);
    return () => window.clearTimeout(id);
  }, [visible, exitMs]);

  return rendered;
}
