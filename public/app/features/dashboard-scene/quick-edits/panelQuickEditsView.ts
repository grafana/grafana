import { useCallback, useEffect, useSyncExternalStore } from 'react';

/**
 * How long a panel keeps showing its quick edits after its popover closes. A stray hover over something else and
 * back keeps them; going off to edit something else for longer brings back the panel's actions.
 */
export const QUICK_EDITS_RESET_DELAY_MS = 5000;

const shown = new Set<string>();
const resets = new Map<string, ReturnType<typeof setTimeout>>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setShown(key: string, show: boolean) {
  if (show === shown.has(key)) {
    return;
  }
  if (show) {
    shown.add(key);
  } else {
    shown.delete(key);
  }
  listeners.forEach((listener) => listener());
}

function cancelReset(key: string) {
  clearTimeout(resets.get(key));
  resets.delete(key);
}

/**
 * Whether the panel's edit popover shows its quick edits instead of its actions. Lives outside the popover, as its
 * content unmounts each time it closes. Call it from content that is mounted only while the popover is open.
 */
export function usePanelQuickEditsView(key: string): [boolean, (show: boolean) => void] {
  const isShown = useSyncExternalStore(subscribe, () => shown.has(key));

  useEffect(() => {
    cancelReset(key);
    return () => {
      if (!shown.has(key)) {
        return;
      }
      resets.set(
        key,
        setTimeout(() => {
          resets.delete(key);
          setShown(key, false);
        }, QUICK_EDITS_RESET_DELAY_MS)
      );
    };
  }, [key]);

  const setView = useCallback((show: boolean) => setShown(key, show), [key]);
  return [isShown, setView];
}
