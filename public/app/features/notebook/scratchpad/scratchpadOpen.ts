import { useSyncExternalStore } from 'react';

// Whether the scratchpad panel is docked. Module state because the dashboard panel menu is built outside
// React and Explore's toolbar sits in a different tree from the sidebar.
let open = false;
const listeners = new Set<() => void>();

export function isScratchpadOpen(): boolean {
  return open;
}

export function setScratchpadOpen(next: boolean): void {
  if (open === next) {
    return;
  }
  open = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useScratchpadOpen(): boolean {
  return useSyncExternalStore(subscribe, isScratchpadOpen);
}
